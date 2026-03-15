import { INITIAL_GOLD, MAIN_WALLET_ID } from "@/constants/economy";
import { getDb } from "@/db/database";
import { tavernRepository } from "@/db/repositories/tavernRepository";
import { getTotalExpForLevel } from "@/game/progression";
import { buildDefaultTacticsForClass } from "@/game/tactics/defaults";
import type { TavernCandidateRecord, TavernRefreshState } from "@/types/models";
import { generateId } from "@/utils/id";
import { generateTimeSeed } from "@/utils/rng";
import { adventurerGenerationService } from "./adventurerGenerationService";

const CANDIDATE_COUNT = 4;
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

const buildRefreshState = (seed: number, now: Date): TavernRefreshState => ({
  seed,
  lastGeneratedAt: now.toISOString(),
  nextRefreshAt: new Date(now.getTime() + REFRESH_INTERVAL_MS).toISOString(),
});

const isExpired = (refreshState: TavernRefreshState | null, now: Date): boolean => {
  if (!refreshState) return true;
  const nextRefresh = Date.parse(refreshState.nextRefreshAt);
  return !Number.isFinite(nextRefresh) || now.getTime() >= nextRefresh;
};

type HireResult =
  | { ok: true; characterId: string; walletGold: number }
  | { ok: false; reason: "INSUFFICIENT_GOLD"; requiredGold: number; walletGold: number };

export const tavernService = {
  async getTavernState(forceRefresh = false): Promise<{
    candidates: TavernCandidateRecord[];
    refreshState: TavernRefreshState;
  }> {
    const now = new Date();
    const [candidates, refreshState] = await Promise.all([
      tavernRepository.listCandidates(),
      tavernRepository.getRefreshState(),
    ]);

    if (!forceRefresh && candidates.length === CANDIDATE_COUNT && !isExpired(refreshState, now)) {
      return {
        candidates,
        refreshState: refreshState!,
      };
    }

    const seed = generateTimeSeed();
    const nextRefreshState = buildRefreshState(seed, now);
    const nextCandidates = adventurerGenerationService.generateCandidates(
      seed,
      CANDIDATE_COUNT,
      nextRefreshState.lastGeneratedAt
    );
    await tavernRepository.replaceCandidates(nextCandidates, nextRefreshState);
    return {
      candidates: nextCandidates,
      refreshState: nextRefreshState,
    };
  },

  async hireCandidate(candidateId: string): Promise<HireResult> {
    const candidate = await tavernRepository.getCandidateById(candidateId);
    if (!candidate) {
      throw new Error("Candidate not found");
    }

    const db = await getDb();
    await db.execAsync("BEGIN;");
    try {
      await db.runAsync(
        `INSERT OR IGNORE INTO wallets (id, gold, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [MAIN_WALLET_ID, INITIAL_GOLD]
      );
      const wallet = await db.getFirstAsync<{ gold: number }>(
        "SELECT gold FROM wallets WHERE id = ? LIMIT 1",
        [MAIN_WALLET_ID]
      );
      const walletGold = Math.max(0, Math.floor(wallet?.gold ?? 0));
      if (walletGold < candidate.priceGold) {
        await db.execAsync("ROLLBACK;");
        return {
          ok: false,
          reason: "INSUFFICIENT_GOLD",
          requiredGold: candidate.priceGold,
          walletGold,
        };
      }

      const characterId = generateId("char");
      const nextGold = walletGold - candidate.priceGold;
      await db.runAsync(
        "UPDATE wallets SET gold = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [nextGold, MAIN_WALLET_ID]
      );
      await db.runAsync(
        `INSERT INTO characters
        (id, name, class_id, constellation_id, level, exp, base_max_hp, base_atk, base_def, base_spi, base_spd, base_max_mp, base_mp_regen, current_hp, current_mp, age, growth_multiplier, trait_ids_json, innate_hp_rate, innate_atk_bonus, innate_def_bonus, innate_spi_bonus, innate_spd_bonus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          characterId,
          candidate.name,
          candidate.classId,
          candidate.constellationId,
          candidate.level,
          getTotalExpForLevel(candidate.level),
          candidate.baseMaxHp,
          candidate.baseAtk,
          candidate.baseDef,
          candidate.baseSpi,
          candidate.baseSpd,
          candidate.baseMaxMp,
          candidate.baseMpRegen,
          candidate.baseMaxHp,
          candidate.baseMaxMp,
          candidate.age,
          candidate.growthMultiplier,
          JSON.stringify(candidate.traitIds),
          candidate.innateHpRate,
          candidate.innateAtkBonus,
          candidate.innateDefBonus,
          candidate.innateSpiBonus,
          candidate.innateSpdBonus,
        ]
      );

      const tacticsRules = buildDefaultTacticsForClass(characterId, candidate.classId);
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

      await db.runAsync("DELETE FROM tavern_candidates WHERE id = ?", [candidateId]);
      await db.execAsync("COMMIT;");
      return { ok: true, characterId, walletGold: nextGold };
    } catch (error) {
      try {
        await db.execAsync("ROLLBACK;");
      } catch {
        // noop
      }
      throw error;
    }
  },
};
