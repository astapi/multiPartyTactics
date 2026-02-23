import { describe, expect, it } from "vitest";
import { generateEncounter } from "@/game/encounter";

describe("game/encounter", () => {
  it("generates deterministic encounters from the same seed", () => {
    const params = { dungeonId: "crestoria_dungeon_1_4", floor: 3, seed: 12345 };
    const a = generateEncounter(params);
    const b = generateEncounter(params);
    expect(a).toEqual(b);
    expect(a.rollMeta.enemyCount).toBe(a.enemies.length);
    expect(a.enemies.length).toBeGreaterThanOrEqual(1);
    expect(a.enemies.length).toBeLessThanOrEqual(3);
  });

  it("clamps floor to minimum 1", () => {
    const result = generateEncounter({ dungeonId: "crestoria_dungeon_1_4", floor: 0, seed: 1 });
    expect(result.rollMeta.floor).toBe(1);
  });

  it("throws for unknown dungeon and missing floor table", () => {
    expect(() =>
      generateEncounter({ dungeonId: "unknown_dungeon", floor: 1, seed: 1 })
    ).toThrow("Unknown dungeon id");
    expect(() =>
      generateEncounter({ dungeonId: "crestoria_dungeon_1_4", floor: 999, seed: 1 })
    ).toThrow("No encounter table");
  });
});
