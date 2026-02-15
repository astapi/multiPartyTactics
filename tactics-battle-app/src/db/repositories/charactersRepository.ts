import { getDb } from "@/db/database";
import { CharacterRecord, JobId } from "@/types/models";

type PartyMemberRecord = CharacterRecord & { slotIndex: number };

const mapCharacter = (row: any): CharacterRecord => ({
  id: row.id,
  slotIndex: row.slot_index,
  name: row.name,
  jobId: row.job_id as JobId,
  level: row.level,
  baseMaxHp: row.base_max_hp,
  baseAtk: row.base_atk,
  baseDef: row.base_def,
  baseSpd: row.base_spd,
  baseMaxMp: row.base_max_mp,
  baseMpRegen: row.base_mp_regen,
  currentHp: row.current_hp,
  currentMp: row.current_mp,
});

export const charactersRepository = {
  async list(): Promise<CharacterRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>("SELECT * FROM characters ORDER BY slot_index ASC");
    return rows.map(mapCharacter);
  },

  async upsert(record: CharacterRecord): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO characters
      (id, slot_index, name, job_id, level, base_max_hp, base_atk, base_def, base_spd, base_max_mp, base_mp_regen, current_hp, current_mp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.slotIndex,
        record.name,
        record.jobId,
        record.level,
        record.baseMaxHp,
        record.baseAtk,
        record.baseDef,
        record.baseSpd,
        record.baseMaxMp,
        record.baseMpRegen,
        record.currentHp,
        record.currentMp,
      ]
    );
  },

  async deleteById(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync("DELETE FROM characters WHERE id = ?", [id]);
  },

  async getById(id: string): Promise<CharacterRecord | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>("SELECT * FROM characters WHERE id = ?", [id]);
    return row ? mapCharacter(row) : null;
  },

  async listPartyMembers(): Promise<PartyMemberRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM characters WHERE slot_index IS NOT NULL ORDER BY slot_index ASC"
    );
    return rows.map(mapCharacter).filter((record): record is PartyMemberRecord => record.slotIndex !== null);
  },

  async listUnassigned(): Promise<CharacterRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM characters WHERE slot_index IS NULL ORDER BY name ASC"
    );
    return rows.map(mapCharacter);
  },

  async assignToSlot(characterId: string, slotIndex: number): Promise<void> {
    const db = await getDb();
    await db.runAsync("UPDATE characters SET slot_index = NULL WHERE slot_index = ?", [slotIndex]);
    await db.runAsync("UPDATE characters SET slot_index = ? WHERE id = ?", [slotIndex, characterId]);
  },

  async removeFromSlot(characterId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync("UPDATE characters SET slot_index = NULL WHERE id = ?", [characterId]);
  },
};
