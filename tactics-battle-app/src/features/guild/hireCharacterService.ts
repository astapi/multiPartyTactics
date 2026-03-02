import { getClassById } from "@/constants/classes";
import { getRandomConstellationId } from "@/constants/constellations";
import { INITIAL_GOLD, MAIN_WALLET_ID } from "@/constants/economy";
import { getDb } from "@/db/database";
import { getBaseStatsForClassLevel } from "@/game/progression";
import { buildDefaultTacticsForClass } from "@/game/tactics/defaults";
import type { ClassId } from "@/types/models";
import { generateId } from "@/utils/id";

const ensureMainWalletTx = async (
  db: Awaited<ReturnType<typeof getDb>>
): Promise<void> => {
  await db.runAsync(
    `INSERT OR IGNORE INTO wallets (id, gold, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [MAIN_WALLET_ID, INITIAL_GOLD]
  );
};

export type HireCharacterInput = {
  name: string;
  classId: ClassId;
};

export type HireCharacterResult =
  | {
      ok: true;
      characterId: string;
      walletGold: number;
    }
  | {
      ok: false;
      reason: "INSUFFICIENT_GOLD";
      requiredGold: number;
      walletGold: number;
    };

export const hireCharacterService = {
  async hireCharacter(input: HireCharacterInput): Promise<HireCharacterResult> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error("name is required");
    }

    const classInfo = getClassById(input.classId);
    const requiredGold = classInfo.hiringCost;
    const constellationId = getRandomConstellationId();
    const base = getBaseStatsForClassLevel(input.classId, 1, constellationId);
    const characterId = generateId("char");
    const tacticsRules = buildDefaultTacticsForClass(characterId, input.classId);

    const db = await getDb();
    await db.execAsync("BEGIN;");
    try {
      await ensureMainWalletTx(db);

      const wallet = await db.getFirstAsync<{ gold: number }>(
        "SELECT gold FROM wallets WHERE id = ? LIMIT 1",
        [MAIN_WALLET_ID]
      );
      const walletGold = Math.max(0, Math.floor(wallet?.gold ?? 0));
      if (walletGold < requiredGold) {
        await db.execAsync("ROLLBACK;");
        return {
          ok: false,
          reason: "INSUFFICIENT_GOLD",
          requiredGold,
          walletGold,
        };
      }

      const nextGold = walletGold - requiredGold;
      await db.runAsync(
        `UPDATE wallets
         SET gold = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nextGold, MAIN_WALLET_ID]
      );

      await db.runAsync(
        `INSERT INTO characters
        (id, name, class_id, constellation_id, level, exp, base_max_hp, base_atk, base_def, base_spd, base_max_mp, base_mp_regen, current_hp, current_mp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          characterId,
          trimmedName,
          input.classId,
          constellationId,
          1,
          0,
          base.maxHp,
          base.atk,
          base.def,
          base.spd,
          base.maxMp,
          base.mpRegen,
          base.maxHp,
          base.maxMp,
        ]
      );

      for (const rule of tacticsRules) {
        await db.runAsync(
          `INSERT INTO tactics_rules
          (id, character_id, priority, skill_id, condition_type, condition_params, target_type, target_params)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rule.id,
            characterId,
            rule.priority,
            rule.skillId,
            rule.conditionType,
            rule.conditionParams,
            rule.targetType,
            rule.targetParams,
          ]
        );
      }

      await db.execAsync("COMMIT;");
      return { ok: true, characterId, walletGold: nextGold };
    } catch (error) {
      try {
        await db.execAsync("ROLLBACK;");
      } catch {
        // ignore rollback failure
      }
      throw error;
    }
  },
};
