import { describe, expect, it } from "vitest";
import { DUNGEONS } from "@/constants/dungeons";
import { generateExplorationResult } from "@/game/exploration";
import { makeUnit } from "./helpers";

describe("game/exploration", () => {
  const dungeon = DUNGEONS[0];
  const party = [makeUnit(), makeUnit({ stats: { atk: 18, def: 10, spd: 12 } })];

  it("generates deterministic results and consistent encounter metadata", () => {
    const params = { party, dungeon, floor: 2, seed: 77 };
    const a = generateExplorationResult(params);
    const b = generateExplorationResult(params);

    expect(a).toEqual(b);
    expect(a.events).toHaveLength(a.totalTicks);
    const encounterEvents = a.events.filter((e) => e.type === "ENCOUNTER");
    expect(a.encounterTicks).toEqual(encounterEvents.map((e) => e.tick));
    expect(a.encounters).toHaveLength(encounterEvents.length);
    for (const [index, enc] of a.encounters.entries()) {
      expect(enc.rollMeta.dungeonId).toBe(dungeon.id);
      expect(enc.rollMeta.floor).toBe(2);
      expect(encounterEvents[index]?.tick).toBe(a.encounterTicks[index]);
    }
  });

  it("works with empty party and clamps floor to minimum", () => {
    const result = generateExplorationResult({
      party: [],
      dungeon,
      floor: 0,
      seed: 2,
    });
    expect(result.totalTicks).toBe(40);
    expect(result.events).toHaveLength(40);
    for (const enc of result.encounters) {
      expect(enc.rollMeta.floor).toBe(1);
    }
  });

  it("produces all event types across a reasonable seed range", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300 && seen.size < 4; seed += 1) {
      const result = generateExplorationResult({ party, dungeon, floor: 1, seed });
      for (const event of result.events) seen.add(event.type);
    }
    expect(seen).toEqual(new Set(["LOG", "ENCOUNTER", "TREASURE", "TRAP"]));
  });

  it("attaches expected payload shape for trap / treasure events when present", () => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const result = generateExplorationResult({ party, dungeon, floor: 3, seed });
      const trap = result.events.find((event) => event.type === "TRAP");
      const treasure = result.events.find((event) => event.type === "TREASURE");
      if (trap && treasure) {
        expect(trap.payload?.damage).toBeGreaterThanOrEqual(1);
        expect(typeof trap.payload?.debuffType).toBe("string");
        expect(typeof treasure.payload?.reward?.baseItemId).toBe("string");
        expect(treasure.payload?.reward?.sourceType).toBe("TREASURE_CHEST");
        expect(typeof treasure.payload?.reward?.grantKey).toBe("string");
        return;
      }
    }
    throw new Error("trap/treasure payload verification seed not found within range");
  });
});
