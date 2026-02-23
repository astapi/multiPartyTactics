import { afterEach, describe, expect, it, vi } from "vitest";
import { createBattleSessionId, createSkillMap, DEFAULT_SKILLS } from "@/game/battleSetup";
import { toUnit } from "@/game/partyMapper";
import { generateId } from "@/utils/id";
import { createSeededRng, generateTimeSeed } from "@/utils/rng";
import { makeSkill } from "./helpers";

describe("misc testable logic", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps character records into battle units", () => {
    const unit = toUnit({
      id: "c1",
      slotIndex: 2,
      name: "Alicia",
      classId: "CLERIC",
      level: 1,
      baseMaxHp: 80,
      baseAtk: 5,
      baseDef: 6,
      baseSpd: 10,
      baseMaxMp: 35,
      baseMpRegen: 2,
      currentHp: 70,
      currentMp: 20,
    });
    expect(unit).toMatchObject({
      id: "c1",
      name: "Alicia",
      classId: "CLERIC",
      hp: 70,
      mp: 20,
      order: 3,
      stats: { maxHp: 80, atk: 5, def: 6, spd: 10, maxMp: 35, mpRegen: 2 },
    });
  });

  it("builds a skill map and keeps the last duplicate entry", () => {
    const a1 = makeSkill({ id: "dup", name: "First" });
    const a2 = makeSkill({ id: "dup", name: "Second" });
    const map = createSkillMap([a1, a2]);
    expect(map.get("dup")?.name).toBe("Second");
  });

  it("exposes default skills and generates battle session ids", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    expect(DEFAULT_SKILLS.length).toBeGreaterThan(0);
    expect(DEFAULT_SKILLS.some((skill) => skill.id === "claw")).toBe(true);
    expect(generateId("test")).toBe("test-1700000000000-4fzzzx");
    expect(createBattleSessionId()).toBe("battle-1700000000000-4fzzzx");
  });

  it("provides deterministic seeded RNG and time seed", () => {
    const rngA = createSeededRng(42);
    const rngB = createSeededRng(42);
    const seqA = [rngA(), rngA(), rngA()];
    const seqB = [rngB(), rngB(), rngB()];
    expect(seqA).toEqual(seqB);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);

    vi.spyOn(Date, "now").mockReturnValue(2147483650);
    expect(generateTimeSeed()).toBe(3);
  });
});
