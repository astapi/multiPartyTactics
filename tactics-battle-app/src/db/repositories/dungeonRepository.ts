import { getDb } from "@/db/database";
import { DungeonProgressRecord } from "@/types/models";

const mapProgress = (row: any): DungeonProgressRecord => ({
  id: row.id,
  dungeonId: row.dungeon_id,
  currentFloor: row.current_floor,
  isCleared: row.is_cleared,
});

export const dungeonRepository = {
  async list(): Promise<DungeonProgressRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>("SELECT * FROM dungeon_progress ORDER BY dungeon_id ASC");
    return rows.map(mapProgress);
  },

  async upsert(progress: DungeonProgressRecord): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO dungeon_progress
      (id, dungeon_id, current_floor, is_cleared) VALUES (?, ?, ?, ?)`,
      [progress.id, progress.dungeonId, progress.currentFloor, progress.isCleared]
    );
  },
};
