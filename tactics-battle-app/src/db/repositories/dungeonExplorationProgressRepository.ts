import { getDb } from "@/db/database";
import { DungeonFloorExplorationProgressRecord } from "@/types/models";

type DungeonExplorationProgressRow = {
  dungeon_id: string;
  floor: number;
  exploration_percent: number;
  stairs_discovered: number;
  updated_at: string;
};

const clampPercent = (value: number): number => {
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(clamped * 100) / 100;
};

const mapRow = (row: DungeonExplorationProgressRow): DungeonFloorExplorationProgressRecord => ({
  dungeonId: row.dungeon_id,
  floor: row.floor,
  explorationPercent: clampPercent(row.exploration_percent),
  stairsDiscovered: row.stairs_discovered === 1,
  updatedAt: row.updated_at,
});

type UpsertInput = Omit<DungeonFloorExplorationProgressRecord, "updatedAt">;

export const dungeonExplorationProgressRepository = {
  async listByDungeon(dungeonId: string): Promise<DungeonFloorExplorationProgressRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<DungeonExplorationProgressRow>(
      `SELECT dungeon_id, floor, exploration_percent, stairs_discovered, updated_at
       FROM dungeon_floor_exploration_progress
       WHERE dungeon_id = ?
       ORDER BY floor ASC`,
      [dungeonId]
    );
    return rows.map(mapRow);
  },

  async listByDungeonAndRange(params: {
    dungeonId: string;
    startFloor: number;
    endFloor: number;
  }): Promise<DungeonFloorExplorationProgressRecord[]> {
    const db = await getDb();
    const start = Math.min(params.startFloor, params.endFloor);
    const end = Math.max(params.startFloor, params.endFloor);
    const rows = await db.getAllAsync<DungeonExplorationProgressRow>(
      `SELECT dungeon_id, floor, exploration_percent, stairs_discovered, updated_at
       FROM dungeon_floor_exploration_progress
       WHERE dungeon_id = ? AND floor BETWEEN ? AND ?
       ORDER BY floor ASC`,
      [params.dungeonId, start, end]
    );
    return rows.map(mapRow);
  },

  async upsert(record: UpsertInput): Promise<void> {
    const db = await getDb();
    const explorationPercent = clampPercent(record.explorationPercent);
    const stairsDiscovered = record.stairsDiscovered;
    await db.runAsync(
      `INSERT INTO dungeon_floor_exploration_progress
        (dungeon_id, floor, exploration_percent, stairs_discovered, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(dungeon_id, floor) DO UPDATE SET
         exploration_percent = MAX(dungeon_floor_exploration_progress.exploration_percent, excluded.exploration_percent),
         stairs_discovered = CASE
           WHEN dungeon_floor_exploration_progress.stairs_discovered = 1 OR excluded.stairs_discovered = 1 THEN 1
           ELSE 0
         END,
         updated_at = CURRENT_TIMESTAMP`,
      [record.dungeonId, Math.max(1, Math.floor(record.floor)), explorationPercent, stairsDiscovered ? 1 : 0]
    );
  },

  async upsertMany(records: UpsertInput[]): Promise<void> {
    if (records.length === 0) return;
    // NOTE:
    // Exploration progress is persisted very frequently during exploration.
    // Avoid wrapping this in BEGIN/COMMIT because reward persistence also uses
    // explicit transactions and expo-sqlite can throw "cannot start a transaction
    // within a transaction" when writes overlap on the same connection.
    for (const record of records) {
      await this.upsert(record);
    }
  },

  async getBundleSummary(params: {
    dungeonId: string;
    bundleStart: number;
    bundleBoss: number;
  }): Promise<{
    dungeonId: string;
    bundleStartFloor: number;
    bundleBossFloor: number;
    currentReachableFloor: number;
    fullyExploredFloors: number;
    stairsDiscoveredFloors: number;
    isBundleCleared: boolean;
  }> {
    const rows = await this.listByDungeonAndRange({
      dungeonId: params.dungeonId,
      startFloor: params.bundleStart,
      endFloor: params.bundleBoss,
    });
    const map = new Map(rows.map((row) => [row.floor, row]));
    let currentReachableFloor = params.bundleStart;
    let stairsDiscoveredFloors = 0;
    let fullyExploredFloors = 0;
    for (let floor = params.bundleStart; floor <= params.bundleBoss; floor += 1) {
      const row = map.get(floor);
      if (row?.stairsDiscovered) {
        stairsDiscoveredFloors += 1;
        if (floor < params.bundleBoss) {
          currentReachableFloor = floor + 1;
        }
      }
      if ((row?.explorationPercent ?? 0) >= 100) {
        fullyExploredFloors += 1;
      }
    }
    const bossProgress = map.get(params.bundleBoss);
    return {
      dungeonId: params.dungeonId,
      bundleStartFloor: params.bundleStart,
      bundleBossFloor: params.bundleBoss,
      currentReachableFloor,
      fullyExploredFloors,
      stairsDiscoveredFloors,
      isBundleCleared: bossProgress?.stairsDiscovered ?? false,
    };
  },
};
