import * as SQLite from "expo-sqlite";
import { MIGRATION_001 } from "./migrations/001_initial";

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

  try {
    await migrateBattleSessionStatusToDraw();

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
