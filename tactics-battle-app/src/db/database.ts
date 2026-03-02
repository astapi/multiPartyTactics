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

  // Hotfix for v2 databases created before exp/step_count were in base schema.
  const characterColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(characters)");
  const characterColumnSet = new Set(characterColumns.map((column) => column.name));
  if (!characterColumnSet.has("exp")) {
    await db.execAsync(MIGRATION_005);
  }

  const dungeonPartyUiColumns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(dungeon_party_ui_state)"
  );
  const dungeonPartyUiColumnSet = new Set(dungeonPartyUiColumns.map((column) => column.name));
  if (!dungeonPartyUiColumnSet.has("step_count")) {
    await db.execAsync(MIGRATION_008);
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
