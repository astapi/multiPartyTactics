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
  try {
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
