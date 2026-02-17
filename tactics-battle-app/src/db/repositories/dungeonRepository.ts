import { getDb } from "@/db/database";
import { DungeonProgressRecord } from "@/types/models";

const mapProgress = (row: any): DungeonProgressRecord => ({
  dungeonId: row.dungeon_id,
  lastEnteredFloor: row.last_entered_floor,
  maxClearedFloor: row.max_cleared_floor,
  clearCount: row.clear_count,
  updatedAt: row.updated_at,
});

export const dungeonRepository = {
  async list(): Promise<DungeonProgressRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM dungeon_progress ORDER BY dungeon_id ASC"
    );
    return rows.map(mapProgress);
  },

  async listUnlockedDungeonIds(): Promise<string[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ dungeon_id: string }>(
      "SELECT dungeon_id FROM unlocked_dungeons ORDER BY dungeon_id ASC"
    );
    return rows.map((row) => row.dungeon_id);
  },

  async unlockDungeon(dungeonId: string, reason: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR IGNORE INTO unlocked_dungeons (dungeon_id, unlock_reason)
       VALUES (?, ?)`,
      [dungeonId, reason]
    );
  },

  async upsert(progress: DungeonProgressRecord): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO dungeon_progress
      (dungeon_id, last_entered_floor, max_cleared_floor, clear_count, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        progress.dungeonId,
        progress.lastEnteredFloor,
        progress.maxClearedFloor,
        progress.clearCount,
      ]
    );
  },
};
