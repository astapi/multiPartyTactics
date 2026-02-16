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
  const invalidClass = await db.getFirstAsync<{ job_id: string }>(
    `SELECT job_id
     FROM characters
     WHERE job_id NOT IN ('GUARDIAN', 'SWORDMAN', 'BERSERKER', 'CLERIC', 'WITCH', 'THIEF')
     LIMIT 1`
  );
  if (invalidClass) {
    throw new Error(
      `Invalid class id found in DB (${invalidClass.job_id}). Reset database and recreate characters.`
    );
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
