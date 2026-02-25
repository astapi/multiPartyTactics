import { getDb } from "@/db/database";
import { isClassId } from "@/constants/classes";
import { CharacterRecord, ClassId, PartyMemberRecord } from "@/types/models";

export const DEFAULT_PARTY_ID = "party_default";

const mapCharacter = (row: any): CharacterRecord => {
  const rawClassId = String(row.class_id ?? "");
  if (!isClassId(rawClassId)) {
    throw new Error(`Invalid class id found in DB: ${rawClassId}`);
  }
  const classId: ClassId = rawClassId;
  return {
    id: row.id,
    slotIndex: row.slot_index ?? null,
    name: row.name,
    classId,
    level: row.level,
    exp: row.exp ?? 0,
    baseMaxHp: row.base_max_hp,
    baseAtk: row.base_atk,
    baseDef: row.base_def,
    baseSpd: row.base_spd,
    baseMaxMp: row.base_max_mp,
    baseMpRegen: row.base_mp_regen,
    currentHp: row.current_hp,
    currentMp: row.current_mp,
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
      (id, name, class_id, level, exp, base_max_hp, base_atk, base_def, base_spd, base_max_mp, base_mp_regen, current_hp, current_mp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        class_id = excluded.class_id,
        level = excluded.level,
        exp = excluded.exp,
        base_max_hp = excluded.base_max_hp,
        base_atk = excluded.base_atk,
        base_def = excluded.base_def,
        base_spd = excluded.base_spd,
        base_max_mp = excluded.base_max_mp,
        base_mp_regen = excluded.base_mp_regen,
        current_hp = excluded.current_hp,
        current_mp = excluded.current_mp`,
      [
        record.id,
        record.name,
        record.classId,
        record.level,
        record.exp,
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

  async listUnassigned(partyId: string = DEFAULT_PARTY_ID): Promise<CharacterRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT c.*, pm.slot_index
       FROM characters c
       LEFT JOIN party_members pm
         ON pm.character_id = c.id AND pm.party_id = ?
       WHERE pm.character_id IS NULL
       ORDER BY c.name ASC`,
      [partyId]
    );
    return rows.map(mapCharacter);
  },

  async assignToSlot(characterId: string, slotIndex: number, partyId: string = DEFAULT_PARTY_ID): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "DELETE FROM party_members WHERE party_id = ? AND slot_index = ?",
      [partyId, slotIndex]
    );
    await db.runAsync(
      "DELETE FROM party_members WHERE party_id = ? AND character_id = ?",
      [partyId, characterId]
    );
    await db.runAsync(
      "INSERT INTO party_members (party_id, character_id, slot_index) VALUES (?, ?, ?)",
      [partyId, characterId, slotIndex]
    );
  },

  async removeFromSlot(characterId: string, partyId: string = DEFAULT_PARTY_ID): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "DELETE FROM party_members WHERE party_id = ? AND character_id = ?",
      [partyId, characterId]
    );
  },
};
