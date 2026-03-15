import { getDb } from "@/db/database";
import { isClassId } from "@/constants/classes";
import {
  DEFAULT_CONSTELLATION_ID,
  isConstellationId,
} from "@/constants/constellations";
import { CharacterRecord, ClassId, PartyMemberRecord } from "@/types/models";

export const DEFAULT_PARTY_ID = "party_default";

const mapCharacter = (row: any): CharacterRecord => {
  const rawClassId = String(row.class_id ?? "");
  if (!isClassId(rawClassId)) {
    throw new Error(`Invalid class id found in DB: ${rawClassId}`);
  }
  const classId: ClassId = rawClassId;
  const rawConstellationId = String(row.constellation_id ?? DEFAULT_CONSTELLATION_ID);
  return {
    id: row.id,
    slotIndex: row.slot_index ?? null,
    name: row.name,
    classId,
    constellationId: isConstellationId(rawConstellationId)
      ? rawConstellationId
      : DEFAULT_CONSTELLATION_ID,
    level: row.level,
    exp: row.exp ?? 0,
    baseMaxHp: row.base_max_hp,
    baseAtk: row.base_atk,
    baseDef: row.base_def,
    baseSpi: row.base_spi ?? 0,
    baseSpd: row.base_spd,
    baseMaxMp: row.base_max_mp,
    baseMpRegen: row.base_mp_regen,
    currentHp: row.current_hp,
    currentMp: row.current_mp,
    age: row.age ?? 18,
    growthMultiplier: row.growth_multiplier ?? 1,
    traitIds: JSON.parse(String(row.trait_ids_json ?? "[]")),
    innateHpRate: row.innate_hp_rate ?? 1,
    innateAtkBonus: row.innate_atk_bonus ?? 0,
    innateDefBonus: row.innate_def_bonus ?? 0,
    innateSpiBonus: row.innate_spi_bonus ?? 0,
    innateSpdBonus: row.innate_spd_bonus ?? 0,
  };
};

export const charactersRepository = {
  async list(partyId: string = DEFAULT_PARTY_ID): Promise<CharacterRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT c.*, pm.slot_index
       FROM characters c
       LEFT JOIN party_members pm
         ON pm.character_id = c.id AND pm.party_id = ?
       ORDER BY
         CASE WHEN pm.slot_index IS NULL THEN 1 ELSE 0 END ASC,
         pm.slot_index ASC,
         c.name ASC`,
      [partyId]
    );
    return rows.map(mapCharacter);
  },

  async upsert(record: CharacterRecord): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO characters
      (id, name, class_id, constellation_id, level, exp, base_max_hp, base_atk, base_def, base_spi, base_spd, base_max_mp, base_mp_regen, current_hp, current_mp, age, growth_multiplier, trait_ids_json, innate_hp_rate, innate_atk_bonus, innate_def_bonus, innate_spi_bonus, innate_spd_bonus)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        class_id = excluded.class_id,
        constellation_id = excluded.constellation_id,
        level = excluded.level,
        exp = excluded.exp,
        base_max_hp = excluded.base_max_hp,
        base_atk = excluded.base_atk,
        base_def = excluded.base_def,
        base_spi = excluded.base_spi,
        base_spd = excluded.base_spd,
        base_max_mp = excluded.base_max_mp,
        base_mp_regen = excluded.base_mp_regen,
        current_hp = excluded.current_hp,
        current_mp = excluded.current_mp,
        age = excluded.age,
        growth_multiplier = excluded.growth_multiplier,
        trait_ids_json = excluded.trait_ids_json,
        innate_hp_rate = excluded.innate_hp_rate,
        innate_atk_bonus = excluded.innate_atk_bonus,
        innate_def_bonus = excluded.innate_def_bonus,
        innate_spi_bonus = excluded.innate_spi_bonus,
        innate_spd_bonus = excluded.innate_spd_bonus`,
      [
        record.id,
        record.name,
        record.classId,
        record.constellationId,
        record.level,
        record.exp,
        record.baseMaxHp,
        record.baseAtk,
        record.baseDef,
        record.baseSpi,
        record.baseSpd,
        record.baseMaxMp,
        record.baseMpRegen,
        record.currentHp,
        record.currentMp,
        record.age,
        record.growthMultiplier,
        JSON.stringify(record.traitIds),
        record.innateHpRate,
        record.innateAtkBonus,
        record.innateDefBonus,
        record.innateSpiBonus,
        record.innateSpdBonus,
      ]
    );
  },

  async deleteById(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync("DELETE FROM characters WHERE id = ?", [id]);
  },

  async getById(id: string, partyId: string = DEFAULT_PARTY_ID): Promise<CharacterRecord | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>(
      `SELECT c.*, pm.slot_index
       FROM characters c
       LEFT JOIN party_members pm
         ON pm.character_id = c.id AND pm.party_id = ?
       WHERE c.id = ?`,
      [partyId, id]
    );
    return row ? mapCharacter(row) : null;
  },

  async listPartyMembers(partyId: string = DEFAULT_PARTY_ID): Promise<PartyMemberRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT c.*, pm.slot_index
       FROM party_members pm
       INNER JOIN characters c ON c.id = pm.character_id
       WHERE pm.party_id = ?
       ORDER BY pm.slot_index ASC`,
      [partyId]
    );
    return rows.map(mapCharacter).filter((record): record is PartyMemberRecord => record.slotIndex !== null);
  },

  async listUnassigned(): Promise<CharacterRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT c.*, pm.slot_index
       FROM characters c
       LEFT JOIN party_members pm ON pm.character_id = c.id
       WHERE pm.character_id IS NULL
       ORDER BY c.name ASC`
    );
    return rows.map(mapCharacter);
  },

  async assignToSlot(characterId: string, slotIndex: number, partyId: string = DEFAULT_PARTY_ID): Promise<void> {
    const db = await getDb();
    await db.execAsync("BEGIN;");
    try {
      await db.runAsync(
        "DELETE FROM party_members WHERE party_id = ? AND slot_index = ?",
        [partyId, slotIndex]
      );
      await db.runAsync(
        "DELETE FROM party_members WHERE character_id = ?",
        [characterId]
      );
      await db.runAsync(
        "INSERT INTO party_members (party_id, character_id, slot_index) VALUES (?, ?, ?)",
        [partyId, characterId, slotIndex]
      );
      await db.execAsync("COMMIT;");
    } catch (error) {
      await db.execAsync("ROLLBACK;");
      throw error;
    }
  },

  async removeFromSlot(characterId: string, partyId: string = DEFAULT_PARTY_ID): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "DELETE FROM party_members WHERE party_id = ? AND character_id = ?",
      [partyId, characterId]
    );
  },
};
