import { describe, expect, it } from "vitest";
import { simulateBattle } from "@/game/battleSimulation";
import type { EncounterEnemy } from "@/game/encounter";
import type { Unit } from "@/game/battle";
import { makeRule, makeSkill } from "./helpers";
import { makeUnit } from "./helpers";

const toEncounter = (id: string, name: string, stats: Unit["stats"]): EncounterEnemy => ({
  enemyId: id,
  name,
  stats,
});

describe("game/battleSimulation", () => {
  it("returns WIN for a stronger party and uses fallback basic attacks", () => {
    const party = [
      makeUnit({ id: "p1", name: "Hero", stats: { atk: 25, def: 5, spd: 20 }, hp: 80 }),
      makeUnit({ id: "p2", name: "Mage", stats: { atk: 18, def: 3, spd: 15 }, hp: 60 }),
    ];
    const enemies = [
      toEncounter("slime", "Slime", { maxHp: 18, atk: 4, def: 1, spd: 5, maxMp: 0, mpRegen: 0 }),
    ];

    const result = simulateBattle({
      sessionId: "s1",
      seed: 1,
      party,
      enemies,
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 5,
    });

    expect(result.outcome).toBe("WIN");
    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs.some((log) => log.actionType === "Attack")).toBe(true);
    expect(result.finalEnemies[0].hp).toBe(0);
    expect(result.finalParty[0]).not.toBe(party[0]);
  });

  it("returns LOSE when enemies overpower the party", () => {
    const party = [makeUnit({ id: "p1", hp: 10, stats: { maxHp: 10, atk: 2, def: 0, spd: 1 } })];
    const enemies = [
      toEncounter("ogre", "Ogre", { maxHp: 80, atk: 50, def: 0, spd: 30, maxMp: 0, mpRegen: 0 }),
    ];

    const result = simulateBattle({
      sessionId: "s2",
      seed: 2,
      party,
      enemies,
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 3,
    });

    expect(result.outcome).toBe("LOSE");
    expect(result.finalParty[0].hp).toBe(0);
  });

  it("returns DRAW immediately when maxTurns is 0", () => {
    const result = simulateBattle({
      sessionId: "s3",
      seed: 3,
      party: [makeUnit({ id: "p1" })],
      enemies: [toEncounter("slime", "Slime", { maxHp: 10, atk: 1, def: 0, spd: 1, maxMp: 0, mpRegen: 0 })],
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 0,
    });

    expect(result).toMatchObject({ outcome: "DRAW", turns: 0 });
    expect(result.logs).toEqual([]);
  });

  it("logs poison tick and stun skip when statuses are present", () => {
    const party = [
      makeUnit({
        id: "p1",
        name: "Stunned Hero",
        hp: 30,
        stats: { maxHp: 30, atk: 10, def: 2, spd: 20, maxMp: 10, mpRegen: 0 },
        statusEffects: [
          { type: "POISON", remainingTurns: 1, potency: 2 },
          { type: "STUN", remainingTurns: 1 },
        ],
      }),
    ];
    const enemies = [
      toEncounter("slime", "Slime", { maxHp: 30, atk: 1, def: 0, spd: 1, maxMp: 0, mpRegen: 0 }),
    ];

    const result = simulateBattle({
      sessionId: "s4",
      seed: 4,
      party,
      enemies,
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 1,
    });

    expect(result.logs.some((log) => log.actionType === "POISON_TICK")).toBe(true);
    expect(result.logs.some((log) => log.actionType === "SKIP")).toBe(true);
  });

  it("uses matched tactics skill when rules resolve successfully", () => {
    const party = [
      makeUnit({
        id: "p1",
        name: "Caster",
        hp: 30,
        mp: 10,
        stats: { maxHp: 30, atk: 5, def: 1, spd: 20, maxMp: 10, mpRegen: 0 },
      }),
    ];
    const enemies = [
      toEncounter("slime", "Slime", { maxHp: 10, atk: 1, def: 0, spd: 1, maxMp: 0, mpRegen: 0 }),
    ];
    const skill = makeSkill({
      id: "heal_self",
      name: "Heal Self",
      type: "heal",
      target: "ALLY",
      effects: [{ kind: "HEAL", amount: 5 }],
    });
    const rules = [
      makeRule({
        id: "r1",
        characterId: "p1",
        skillId: "heal_self",
        conditionType: "ALWAYS",
        targetType: "SELF",
      }),
    ];

    const result = simulateBattle({
      sessionId: "s5",
      seed: 5,
      party,
      enemies,
      tacticsByCharacter: { p1: rules },
      skillMap: new Map([[skill.id, skill]]),
      maxTurns: 1,
    });

    expect(result.logs.some((log) => log.actionType === "Heal Self")).toBe(true);
  });

  it("returns LOSE from enemy branch when party is wiped by poison before enemy acts", () => {
    const party = [
      makeUnit({
        id: "p1",
        hp: 2,
        stats: { maxHp: 10, atk: 1, def: 0, spd: 50 },
        statusEffects: [{ type: "POISON", remainingTurns: 1, potency: 5 }],
      }),
    ];
    const enemies = [
      toEncounter("e1", "Goblin", { maxHp: 10, atk: 1, def: 0, spd: 10, maxMp: 0, mpRegen: 0 }),
      toEncounter("e2", "Goblin", { maxHp: 10, atk: 1, def: 0, spd: 9, maxMp: 0, mpRegen: 0 }),
    ];

    const result = simulateBattle({
      sessionId: "s6",
      seed: 6,
      party,
      enemies,
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 1,
    });

    expect(result.outcome).toBe("LOSE");
    expect(result.logs.some((log) => log.actionType === "POISON_TICK")).toBe(true);
  });
});
