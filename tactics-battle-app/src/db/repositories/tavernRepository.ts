import { getDb } from "@/db/database";
import type { TavernCandidateRecord, TavernRefreshState } from "@/types/models";

const mapCandidate = (row: any): TavernCandidateRecord => ({
  id: String(row.id),
  name: String(row.name),
  classId: row.class_id,
  constellationId: row.constellation_id,
  level: Number(row.level),
  age: Number(row.age),
  growthMultiplier: Number(row.growth_multiplier),
  traitIds: JSON.parse(String(row.trait_ids_json ?? "[]")),
  priceGold: Number(row.price_gold),
  baseMaxHp: Number(row.base_max_hp),
  baseAtk: Number(row.base_atk),
  baseDef: Number(row.base_def),
  baseSpi: Number(row.base_spi),
  baseSpd: Number(row.base_spd),
  baseMaxMp: Number(row.base_max_mp),
  baseMpRegen: Number(row.base_mp_regen),
  innateHpRate: Number(row.innate_hp_rate),
  innateAtkBonus: Number(row.innate_atk_bonus),
  innateDefBonus: Number(row.innate_def_bonus),
  innateSpiBonus: Number(row.innate_spi_bonus),
  innateSpdBonus: Number(row.innate_spd_bonus),
  generatedAt: String(row.generated_at),
});

export const tavernRepository = {
  async listCandidates(): Promise<TavernCandidateRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM tavern_candidates ORDER BY generated_at ASC, id ASC"
    );
    return rows.map(mapCandidate);
  },

  async replaceCandidates(
    candidates: TavernCandidateRecord[],
    refreshState: TavernRefreshState
  ): Promise<void> {
    const db = await getDb();
    await db.execAsync("BEGIN;");
    try {
      await db.runAsync("DELETE FROM tavern_candidates");
      for (const candidate of candidates) {
        await db.runAsync(
          `INSERT INTO tavern_candidates
          (id, name, class_id, constellation_id, level, age, growth_multiplier, trait_ids_json, price_gold, base_max_hp, base_atk, base_def, base_spi, base_spd, base_max_mp, base_mp_regen, innate_hp_rate, innate_atk_bonus, innate_def_bonus, innate_spi_bonus, innate_spd_bonus, generated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            candidate.id,
            candidate.name,
            candidate.classId,
            candidate.constellationId,
            candidate.level,
            candidate.age,
            candidate.growthMultiplier,
            JSON.stringify(candidate.traitIds),
            candidate.priceGold,
            candidate.baseMaxHp,
            candidate.baseAtk,
            candidate.baseDef,
            candidate.baseSpi,
            candidate.baseSpd,
            candidate.baseMaxMp,
            candidate.baseMpRegen,
            candidate.innateHpRate,
            candidate.innateAtkBonus,
            candidate.innateDefBonus,
            candidate.innateSpiBonus,
            candidate.innateSpdBonus,
            candidate.generatedAt,
          ]
        );
      }
      await db.runAsync("DELETE FROM tavern_refresh_state");
      await db.runAsync(
        `INSERT INTO tavern_refresh_state
        (id, last_generated_at, next_refresh_at, seed)
        VALUES (1, ?, ?, ?)`,
        [refreshState.lastGeneratedAt, refreshState.nextRefreshAt, refreshState.seed]
      );
      await db.execAsync("COMMIT;");
    } catch (error) {
      await db.execAsync("ROLLBACK;");
      throw error;
    }
  },

  async getRefreshState(): Promise<TavernRefreshState | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>(
      "SELECT last_generated_at, next_refresh_at, seed FROM tavern_refresh_state WHERE id = 1"
    );
    if (!row) return null;
    return {
      lastGeneratedAt: String(row.last_generated_at),
      nextRefreshAt: String(row.next_refresh_at),
      seed: Number(row.seed),
    };
  },

  async deleteCandidate(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync("DELETE FROM tavern_candidates WHERE id = ?", [id]);
  },

  async getCandidateById(id: string): Promise<TavernCandidateRecord | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>(
      "SELECT * FROM tavern_candidates WHERE id = ? LIMIT 1",
      [id]
    );
    return row ? mapCandidate(row) : null;
  },
};
