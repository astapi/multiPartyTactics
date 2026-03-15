import { getDb } from "@/db/database";
import { isClassId } from "@/constants/classes";
import {
  DEFAULT_CONSTELLATION_ID,
  isConstellationId,
} from "@/constants/constellations";
import { ClassId, PartyMemberRecord, PartyRecord, PartyWithMembers } from "@/types/models";

type PartyRow = {
  id: string;
  name: string;
  created_at: string;
};

type PartyMemberRow = {
  party_id: string;
  slot_index: number;
  id: string;
  name: string;
  class_id: string;
  constellation_id: string | null;
  level: number;
  exp: number;
  base_max_hp: number;
  base_atk: number;
  base_def: number;
  base_spi: number;
  base_spd: number;
  base_max_mp: number;
  base_mp_regen: number;
  current_hp: number;
  current_mp: number;
  age: number;
  growth_multiplier: number;
  trait_ids_json: string;
  innate_hp_rate: number;
  innate_atk_bonus: number;
  innate_def_bonus: number;
  innate_spi_bonus: number;
  innate_spd_bonus: number;
};

const mapParty = (row: PartyRow): PartyRecord => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
});

const mapPartyMember = (row: PartyMemberRow): PartyMemberRecord => {
  if (!isClassId(String(row.class_id ?? ""))) {
    throw new Error(`Invalid class id found in DB: ${String(row.class_id ?? "")}`);
  }
  const classId = row.class_id as ClassId;
  const rawConstellationId = String(row.constellation_id ?? DEFAULT_CONSTELLATION_ID);
  return {
    id: row.id,
    slotIndex: row.slot_index,
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

export const partiesRepository = {
  async getById(id: string): Promise<PartyRecord | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<PartyRow>(
      "SELECT id, name, created_at FROM parties WHERE id = ? LIMIT 1",
      [id]
    );
    return row ? mapParty(row) : null;
  },

  async list(): Promise<PartyRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<PartyRow>(
      "SELECT id, name, created_at FROM parties ORDER BY created_at ASC, id ASC"
    );
    return rows.map(mapParty);
  },

  async create(input: { id: string; name: string }): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT INTO parties (id, name) VALUES (?, ?)",
      [input.id, input.name.trim()]
    );
  },

  async rename(id: string, name: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE parties SET name = ? WHERE id = ?",
      [name.trim(), id]
    );
  },

  async delete(id: string): Promise<void> {
    if (id === "party_default") {
      throw new Error("Cannot delete default party");
    }
    const db = await getDb();
    await db.runAsync("DELETE FROM parties WHERE id = ?", [id]);
  },

  async listWithMembers(): Promise<PartyWithMembers[]> {
    const db = await getDb();
    const [partyRows, memberRows] = await Promise.all([
      db.getAllAsync<PartyRow>("SELECT id, name, created_at FROM parties ORDER BY created_at ASC, id ASC"),
      db.getAllAsync<PartyMemberRow>(
        `SELECT
           pm.party_id,
           pm.slot_index,
           c.id,
           c.name,
           c.class_id,
           c.constellation_id,
           c.level,
           c.exp,
           c.base_max_hp,
           c.base_atk,
           c.base_def,
           c.base_spi,
           c.base_spd,
           c.base_max_mp,
           c.base_mp_regen,
           c.current_hp,
           c.current_mp,
           c.age,
           c.growth_multiplier,
           c.trait_ids_json,
           c.innate_hp_rate,
           c.innate_atk_bonus,
           c.innate_def_bonus,
           c.innate_spi_bonus,
           c.innate_spd_bonus
         FROM party_members pm
         INNER JOIN characters c ON c.id = pm.character_id
         ORDER BY pm.party_id ASC, pm.slot_index ASC`
      ),
    ]);

    const memberMap = new Map<string, PartyMemberRecord[]>();
    for (const row of memberRows) {
      const next = memberMap.get(row.party_id) ?? [];
      next.push(mapPartyMember(row));
      memberMap.set(row.party_id, next);
    }

    return partyRows.map((partyRow) => ({
      party: mapParty(partyRow),
      members: memberMap.get(partyRow.id) ?? [],
    }));
  },
};
