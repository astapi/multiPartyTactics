import { describe, expect, it } from "vitest";
import { createBossEncounter, generateEncounter, listNormalEncounterEnemyIds } from "@/game/encounter";
import dungeonEnemyTableData from "@/data/dungeonEnemyTable.json";
import enemiesData from "@/data/enemies.json";

describe("game/encounter", () => {
  it("generates deterministic encounters from the same seed", () => {
    const params = { dungeonId: "crestoria_dungeon_1_200", floor: 3, seed: 12345 };
    const a = generateEncounter(params);
    const b = generateEncounter(params);
    expect(a).toEqual(b);
    expect(a.rollMeta.enemyCount).toBe(a.enemies.length);
    expect(a.enemies.length).toBeGreaterThanOrEqual(1);
    expect(a.enemies.length).toBeLessThanOrEqual(3);
  });

  it("clamps floor to minimum 1", () => {
    const result = generateEncounter({ dungeonId: "crestoria_dungeon_1_200", floor: 0, seed: 1 });
    expect(result.rollMeta.floor).toBe(1);
  });

  it("throws for unknown dungeon and missing floor table", () => {
    expect(() =>
      generateEncounter({ dungeonId: "unknown_dungeon", floor: 1, seed: 1 })
    ).toThrow("Unknown dungeon id");
    expect(() =>
      generateEncounter({ dungeonId: "crestoria_dungeon_1_200", floor: 999, seed: 1 })
    ).toThrow("No encounter table");
  });

  it("supports crestoria 120-floor dungeon and boss-floor fallback encounters", () => {
    const floor1 = generateEncounter({ dungeonId: "crestoria_dungeon_1_200", floor: 1, seed: 101 });
    const floor10 = generateEncounter({ dungeonId: "crestoria_dungeon_1_200", floor: 10, seed: 110 });
    const floor120 = generateEncounter({ dungeonId: "crestoria_dungeon_1_200", floor: 120, seed: 220 });

    expect(floor1.rollMeta.floor).toBe(1);
    expect(floor10.rollMeta.floor).toBe(10);
    expect(floor120.rollMeta.floor).toBe(120);
    expect(floor1.enemies.length).toBeGreaterThanOrEqual(1);
    expect(floor10.enemies.length).toBeGreaterThanOrEqual(1);
    expect(floor120.enemies.length).toBeGreaterThanOrEqual(1);
  });

  it("covers floors 1-120 and marks boss floors every 10 floors", () => {
    const dungeon = (dungeonEnemyTableData.dungeons as any[]).find(
      (entry) => entry.dungeonId === "crestoria_dungeon_1_200"
    );
    expect(dungeon).toBeTruthy();
    expect(dungeon.floors).toHaveLength(120);
    expect(dungeon.floors[0].floor).toBe(1);
    expect(dungeon.floors[119].floor).toBe(120);
    const bossFloors = dungeon.floors.filter((floor: any) => floor.isBossFloor).map((floor: any) => floor.floor);
    expect(bossFloors).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
  });

  it("includes implemented missing monsters in the normal encounter pool", () => {
    const ids = new Set(listNormalEncounterEnemyIds());
    expect(ids.has("wolf")).toBe(true);
    expect(ids.has("giant_bat")).toBe(true);
    expect(ids.has("wraith")).toBe(true);
    expect(ids.has("ghoul")).toBe(true);
    expect(ids.has("scorpion")).toBe(true);
    expect(ids.has("banshee")).toBe(true);
    expect(ids.has("cyclops")).toBe(true);
    expect(ids.has("vampire")).toBe(true);
    expect(ids.has("shield_golem")).toBe(true);
  });

  it("raises weighted average enemy power across a T boundary (70F -> 71F)", () => {
    const dungeon = (dungeonEnemyTableData.dungeons as any[]).find(
      (entry) => entry.dungeonId === "crestoria_dungeon_1_200"
    );
    const enemyMap = new Map((enemiesData.enemies as any[]).map((enemy) => [enemy.id, enemy]));
    const score = (stats: any) => stats.maxHp + stats.atk * 8 + stats.def * 6 + stats.spd * 5;
    const weightedFloorScore = (floor: number): number => {
      const floorTable = dungeon.floors.find((entry: any) => entry.floor === floor);
      const totalWeight = floorTable.encounters.reduce((sum: number, e: any) => sum + e.weight, 0);
      return floorTable.encounters.reduce((sum: number, e: any) => {
        const master = enemyMap.get(e.enemyId);
        const s = e.statScale ?? 1;
        const scaled = {
          maxHp: Math.max(1, Math.round(master.stats.maxHp * s)),
          atk: Math.max(1, Math.round(master.stats.atk * s)),
          def: Math.max(0, Math.round(master.stats.def * s)),
          spd: Math.max(1, Math.round(master.stats.spd * s)),
        };
        return sum + (e.weight / totalWeight) * score(scaled);
      }, 0);
    };

    const f70 = weightedFloorScore(70);
    const f71 = weightedFloorScore(71);
    expect(f71).toBeGreaterThan(f70 * 1.1);
  });

  it("creates floor-based zodiac boss encounters with boss metadata", () => {
    const result = createBossEncounter({
      dungeonId: "crestoria_dungeon_1_200",
      floor: 10,
      seed: 123,
    });
    expect(result.enemies).toHaveLength(1);
    expect(result.enemies[0]?.name).toBe("星霊導師アリエス");
    expect(result.rollMeta.enemyCount).toBe(1);
    expect(result.rollMeta.encounterKind).toBe("BOSS");
    expect(result.rollMeta.bossName).toBe("星霊導師アリエス");
  });
});
