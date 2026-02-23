import { describe, expect, it } from "vitest";
import { selectVenomTyrantAction } from "@/game/boss-ai";
import { VENOM_TYRANT_SKILLS } from "@/game/skills";
import { makeUnit } from "./helpers";

describe("game/boss-ai", () => {
  const bossBase = () =>
    makeUnit({
      id: "boss",
      name: "Venom Tyrant",
      stats: { maxHp: 260, atk: 14, def: 6, spd: 9, maxMp: 999, mpRegen: 0 },
      hp: 260,
      mp: 999,
      cooldowns: {},
    });

  it("uses enrage below threshold when not already enraged", () => {
    const boss = bossBase();
    boss.hp = 100; // <= 40%
    const allies = [makeUnit({ id: "p1" }), makeUnit({ id: "p2" })];

    const decision = selectVenomTyrantAction(boss, allies, 5);
    expect(decision.skill.id).toBe("enrage");
    expect(decision.target.id).toBe("boss");
  });

  it("uses crushing slam on turn multiples of 3 and targets highest HP", () => {
    const boss = bossBase();
    const allies = [
      makeUnit({ id: "a", hp: 40, classId: "THIEF" }),
      makeUnit({ id: "b", hp: 90, classId: "CLERIC" }),
      makeUnit({ id: "c", hp: 70, classId: "GUARDIAN" }),
    ];

    const decision = selectVenomTyrantAction(boss, allies, 3);
    expect(decision.skill.id).toBe("crushing_slam");
    expect(decision.target.id).toBe("b");
  });

  it("prefers venom spit when slam is unavailable and picks lowest non-poisoned", () => {
    const boss = bossBase();
    boss.cooldowns.crushing_slam = 1;
    const allies = [
      makeUnit({
        id: "p1",
        hp: 10,
        stats: { maxHp: 100 },
        statusEffects: [{ type: "POISON", remainingTurns: 2, potency: 2 }],
      }),
      makeUnit({ id: "p2", hp: 20, stats: { maxHp: 100 } }),
      makeUnit({ id: "p3", hp: 60, stats: { maxHp: 100 } }),
    ];

    const decision = selectVenomTyrantAction(boss, allies, 1);
    expect(decision.skill.id).toBe("venom_spit");
    expect(decision.target.id).toBe("p2");
  });

  it("falls back to claw when other actions are unavailable", () => {
    const boss = bossBase();
    boss.cooldowns.crushing_slam = 1;
    boss.cooldowns.venom_spit = 1;
    boss.effects.push({
      kind: "STAT",
      id: "ENRAGED",
      stat: "atk",
      amount: 4,
      remainingTurns: null,
      source: "enrage",
    });
    boss.hp = 100;
    const allies = [
      makeUnit({ id: "low", hp: 10, stats: { maxHp: 100 } }),
      makeUnit({ id: "high", hp: 90, stats: { maxHp: 100 } }),
    ];

    const decision = selectVenomTyrantAction(boss, allies, 2);
    expect(VENOM_TYRANT_SKILLS.some((skill) => skill.id === decision.skill.id)).toBe(true);
    expect(decision.skill.id).toBe("claw");
    expect(decision.target.id).toBe("low");
  });
});
