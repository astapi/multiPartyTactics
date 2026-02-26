import * as SQLite from "expo-sqlite";
import { MIGRATION_001 } from "./migrations/001_initial";
import { MIGRATION_002 } from "./migrations/002_equipment_loot";
import { MIGRATION_003 } from "./migrations/003_character_equipment";
import { MIGRATION_005 } from "./migrations/005_character_exp";
import { MIGRATION_006 } from "./migrations/006_dungeon_party_ui_state";
import { MIGRATION_007 } from "./migrations/007_dungeon_floor_exploration_progress";
import { MIGRATION_008 } from "./migrations/008_dungeon_party_ui_step_count";
import { MIGRATION_009 } from "./migrations/009_character_constellation";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const DATABASE_NAME = "tactics_battle.db";

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
  const migrateCharacterExpColumn = async (): Promise<void> => {
    const characterColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(characters)");
    const characterColumnSet = new Set(characterColumns.map((column) => column.name));
    if (characterColumnSet.has("exp")) {
      return;
    }
    await db.execAsync(MIGRATION_005);
  };
  const migrateBattleSessionStatusToDraw = async (): Promise<void> => {
    const schema = await db.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'battle_sessions'"
    );
    if (!schema?.sql || schema.sql.includes("'DRAW'")) {
      return;
    }

    await db.execAsync(`
      BEGIN;
      ALTER TABLE battle_sessions RENAME TO battle_sessions_old;
      CREATE TABLE battle_sessions (
        id TEXT PRIMARY KEY,
        dungeon_id TEXT NOT NULL,
        floor INTEGER NOT NULL,
        turn INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'WIN', 'LOSE', 'DRAW')),
        exploration_seed INTEGER,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at TEXT,
        FOREIGN KEY (dungeon_id) REFERENCES dungeons(id)
      );
      INSERT INTO battle_sessions (id, dungeon_id, floor, turn, status, exploration_seed, started_at, ended_at)
      SELECT id, dungeon_id, floor, turn, status, exploration_seed, started_at, ended_at
      FROM battle_sessions_old;
      DROP TABLE battle_sessions_old;
      COMMIT;
    `);
  };

  const migrateEquipmentInventoryStacksSchema = async (): Promise<void> => {
    const schema = await db.getFirstAsync<{ sql: string | null }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'equipment_inventory_stacks'"
    );
    if (!schema?.sql) return;
    if (schema.sql.includes("mutation_prefix_key")) {
      // Ensure index exists even if table is already up to date.
      await db.execAsync(
        "CREATE INDEX IF NOT EXISTS idx_equipment_stacks_base_item ON equipment_inventory_stacks(base_item_id);"
      );
      return;
    }

    await db.execAsync(`
      BEGIN;
      ALTER TABLE equipment_inventory_stacks RENAME TO equipment_inventory_stacks_old;
      CREATE TABLE equipment_inventory_stacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        base_item_id TEXT NOT NULL,
        mutation_prefix_id TEXT,
        mutation_prefix_key TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity >= 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (base_item_id, mutation_prefix_key)
      );
      INSERT INTO equipment_inventory_stacks
        (base_item_id, mutation_prefix_id, mutation_prefix_key, quantity, created_at, updated_at)
      SELECT
        base_item_id,
        mutation_prefix_id,
        COALESCE(mutation_prefix_id, '') AS mutation_prefix_key,
        SUM(quantity) AS quantity,
        MIN(created_at) AS created_at,
        MAX(updated_at) AS updated_at
      FROM equipment_inventory_stacks_old
      GROUP BY base_item_id, mutation_prefix_id, COALESCE(mutation_prefix_id, '');
      DROP TABLE equipment_inventory_stacks_old;
      CREATE INDEX IF NOT EXISTS idx_equipment_stacks_base_item ON equipment_inventory_stacks(base_item_id);
      COMMIT;
    `);
  };
  const migrateDungeonPartyUiStepCountColumn = async (): Promise<void> => {
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(dungeon_party_ui_state)");
    const columnSet = new Set(columns.map((column) => column.name));
    if (columnSet.has("step_count")) return;
    await db.execAsync(MIGRATION_008);
  };
  const migrateCharacterConstellationColumn = async (): Promise<void> => {
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(characters)");
    const columnSet = new Set(columns.map((column) => column.name));
    if (columnSet.has("constellation_id")) return;
    await db.execAsync(MIGRATION_009);
  };

  try {
    await migrateCharacterExpColumn();
    await migrateBattleSessionStatusToDraw();
    await migrateEquipmentInventoryStacksSchema();
    await migrateDungeonPartyUiStepCountColumn();
    await migrateCharacterConstellationColumn();

    const invalidClass = await db.getFirstAsync<{ class_id: string }>(
      `SELECT class_id
       FROM characters
       WHERE class_id NOT IN ('GUARDIAN', 'SWORDMAN', 'BERSERKER', 'CLERIC', 'WITCH', 'THIEF')
       LIMIT 1`
    );
    if (invalidClass) {
      throw new Error(
        `Invalid class id found in DB (${invalidClass.class_id}). Reset database and recreate characters.`
      );
    }

    const dungeonProgressColumns = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(dungeon_progress)"
    );
    const dungeonProgressColumnSet = new Set(
      dungeonProgressColumns.map((column) => column.name)
    );
    if (!dungeonProgressColumnSet.has("last_entered_floor")) {
      throw new Error(
        "Legacy dungeon schema detected. Reset database and recreate dungeon data."
      );
    }

    const battleSessionColumns = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(battle_sessions)"
    );
    const battleSessionColumnSet = new Set(
      battleSessionColumns.map((column) => column.name)
    );
    if (!battleSessionColumnSet.has("dungeon_id")) {
      throw new Error(
        "Legacy battle schema detected. Reset database and recreate dungeon data."
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("no such column: class_id")) {
      throw new Error("Legacy schema detected. Reset database and recreate characters.");
    }
    throw error;
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
