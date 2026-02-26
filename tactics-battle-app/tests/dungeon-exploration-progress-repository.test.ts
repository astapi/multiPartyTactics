import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  dungeon_id: string;
  floor: number;
  exploration_percent: number;
  stairs_discovered: number;
  updated_at: string;
};

class FakeDb {
  private rows = new Map<string, Row>();

  reset(): void {
    this.rows = new Map();
  }

  async getAllAsync<T>(query: string, params: any[] = []): Promise<T[]> {
    if (query.includes("WHERE dungeon_id = ? AND floor BETWEEN ? AND ?")) {
      const [dungeonId, start, end] = params;
      return Array.from(this.rows.values())
        .filter((row) => row.dungeon_id === dungeonId && row.floor >= start && row.floor <= end)
        .sort((a, b) => a.floor - b.floor) as T[];
    }
    if (query.includes("WHERE dungeon_id = ?")) {
      const [dungeonId] = params;
      return Array.from(this.rows.values())
        .filter((row) => row.dungeon_id === dungeonId)
        .sort((a, b) => a.floor - b.floor) as T[];
    }
    return [] as T[];
  }

  async runAsync(_query: string, params: any[]): Promise<void> {
    const [dungeonId, floor, explorationPercent, stairsDiscovered] = params;
    const key = `${dungeonId}:${floor}`;
    const current = this.rows.get(key);
    const next: Row = {
      dungeon_id: dungeonId,
      floor,
      exploration_percent: Math.max(current?.exploration_percent ?? 0, explorationPercent),
      stairs_discovered: current?.stairs_discovered === 1 || stairsDiscovered === 1 ? 1 : 0,
      updated_at: new Date().toISOString(),
    };
    this.rows.set(key, next);
  }

  async execAsync(_sql: string): Promise<void> {}
}

const fakeDb = new FakeDb();

vi.mock("@/db/database", () => ({
  getDb: vi.fn(async () => fakeDb),
}));

import { dungeonExplorationProgressRepository } from "@/db/repositories/dungeonExplorationProgressRepository";

describe("dungeonExplorationProgressRepository", () => {
  beforeEach(async () => {
    fakeDb.reset();
  });

  it("upserts and lists rows by dungeon", async () => {
    await dungeonExplorationProgressRepository.upsert({
      dungeonId: "crestoria_dungeon_1_200",
      floor: 1,
      explorationPercent: 20,
      stairsDiscovered: false,
    });
    await dungeonExplorationProgressRepository.upsert({
      dungeonId: "crestoria_dungeon_1_200",
      floor: 2,
      explorationPercent: 60,
      stairsDiscovered: true,
    });
    const rows = await dungeonExplorationProgressRepository.listByDungeon("crestoria_dungeon_1_200");
    expect(rows.map((row) => row.floor)).toEqual([1, 2]);
    expect(rows[1]?.stairsDiscovered).toBe(true);
  });

  it("keeps max exploration_percent and sticky stairs_discovered on upsert", async () => {
    await dungeonExplorationProgressRepository.upsert({
      dungeonId: "d1",
      floor: 3,
      explorationPercent: 70,
      stairsDiscovered: true,
    });
    await dungeonExplorationProgressRepository.upsert({
      dungeonId: "d1",
      floor: 3,
      explorationPercent: 40,
      stairsDiscovered: false,
    });
    const rows = await dungeonExplorationProgressRepository.listByDungeon("d1");
    expect(rows[0]?.explorationPercent).toBe(70);
    expect(rows[0]?.stairsDiscovered).toBe(true);
  });

  it("does not auto-mark stairs_discovered from exploration percent alone", async () => {
    await dungeonExplorationProgressRepository.upsert({
      dungeonId: "d_boss",
      floor: 5,
      explorationPercent: 100,
      stairsDiscovered: false,
    });

    const rows = await dungeonExplorationProgressRepository.listByDungeon("d_boss");
    expect(rows[0]?.explorationPercent).toBe(100);
    expect(rows[0]?.stairsDiscovered).toBe(false);
  });

  it("lists by range and computes bundle summary", async () => {
    await dungeonExplorationProgressRepository.upsertMany([
      { dungeonId: "d2", floor: 1, explorationPercent: 100, stairsDiscovered: true },
      { dungeonId: "d2", floor: 2, explorationPercent: 50, stairsDiscovered: true },
      { dungeonId: "d2", floor: 3, explorationPercent: 20, stairsDiscovered: false },
    ]);
    const rangeRows = await dungeonExplorationProgressRepository.listByDungeonAndRange({
      dungeonId: "d2",
      startFloor: 1,
      endFloor: 2,
    });
    expect(rangeRows).toHaveLength(2);
    const summary = await dungeonExplorationProgressRepository.getBundleSummary({
      dungeonId: "d2",
      bundleStart: 1,
      bundleBoss: 3,
    });
    expect(summary.currentReachableFloor).toBe(3);
    expect(summary.fullyExploredFloors).toBe(1);
    expect(summary.stairsDiscoveredFloors).toBe(2);
    expect(summary.isBundleCleared).toBe(false);
  });
});
