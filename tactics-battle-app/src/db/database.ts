import * as SQLite from "expo-sqlite";
import { MIGRATION_001 } from "./migrations/001_initial";
import { MIGRATION_002 } from "./migrations/002_equipment_loot";
import { MIGRATION_003 } from "./migrations/003_character_equipment";
import { MIGRATION_005 } from "./migrations/005_character_exp";
import { MIGRATION_006 } from "./migrations/006_dungeon_party_ui_state";
import { MIGRATION_007 } from "./migrations/007_dungeon_floor_exploration_progress";
import { MIGRATION_008 } from "./migrations/008_dungeon_party_ui_step_count";
import { MIGRATION_010 } from "./migrations/010_shop_economy";
import { MIGRATION_011 } from "./migrations/011_consumable_inventory";
import { MIGRATION_012 } from "./migrations/012_crestoria_floor_cap";
import { MIGRATION_013 } from "./migrations/013_tavern_and_character_traits";
import { MIGRATION_014 } from "./migrations/014_equipment_instance_stats";
import { MIGRATION_015 } from "./migrations/015_dungeon_party_ui_return_condition";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const DATABASE_NAME = "tactics_battle_v2.db";

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
};

export const initializeDatabase = async (): Promise<void> => {
  const db = await getDb();
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync(MIGRATION_001);
  await db.execAsync(MIGRATION_002);
  await db.execAsync(MIGRATION_003);
  await db.execAsync(MIGRATION_006);
  await db.execAsync(MIGRATION_007);
  await db.execAsync(MIGRATION_010);
  await db.execAsync(MIGRATION_011);
  await db.execAsync(MIGRATION_012);
  const characterColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(characters)");
  const characterColumnSet = new Set(characterColumns.map((column) => column.name));

  // Hotfix for v2 databases created before exp/step_count were in base schema.
  if (!characterColumnSet.has("exp")) {
    await db.execAsync(MIGRATION_005);
  }
  if (!characterColumnSet.has("base_spi")) {
    await db.execAsync(MIGRATION_013);
  } else {
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS tavern_candidates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        class_id TEXT NOT NULL CHECK (class_id IN ('GUARDIAN', 'SWORDMAN', 'BERSERKER', 'CLERIC', 'WITCH', 'THIEF', 'PORTER')),
        constellation_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        age INTEGER NOT NULL,
        growth_multiplier REAL NOT NULL,
        trait_ids_json TEXT NOT NULL,
        price_gold INTEGER NOT NULL,
        base_max_hp INTEGER NOT NULL,
        base_atk INTEGER NOT NULL,
        base_def INTEGER NOT NULL,
        base_spi INTEGER NOT NULL,
        base_spd INTEGER NOT NULL,
        base_max_mp INTEGER NOT NULL,
        base_mp_regen INTEGER NOT NULL,
        innate_hp_rate REAL NOT NULL,
        innate_atk_bonus INTEGER NOT NULL,
        innate_def_bonus INTEGER NOT NULL,
        innate_spi_bonus INTEGER NOT NULL,
        innate_spd_bonus INTEGER NOT NULL,
        generated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tavern_refresh_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_generated_at TEXT NOT NULL,
        next_refresh_at TEXT NOT NULL,
        seed INTEGER NOT NULL
      );`
    );
  }

  const equipmentStackColumns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(equipment_inventory_stacks)"
  );
  const equipmentStackColumnSet = new Set(equipmentStackColumns.map((column) => column.name));
  if (!equipmentStackColumnSet.has("stats_key")) {
    await db.execAsync(MIGRATION_014);
  }

  const dungeonPartyUiColumns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(dungeon_party_ui_state)"
  );
  const dungeonPartyUiColumnSet = new Set(dungeonPartyUiColumns.map((column) => column.name));
  if (!dungeonPartyUiColumnSet.has("step_count")) {
    await db.execAsync(MIGRATION_008);
  }
  if (!dungeonPartyUiColumnSet.has("return_condition")) {
    await db.execAsync(MIGRATION_015);
  }
};

export const resetDatabase = async (): Promise<void> => {
  if (dbPromise) {
    const db = await dbPromise;
    await db.closeAsync();
    dbPromise = null;
  }
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
  await initializeDatabase();
};
