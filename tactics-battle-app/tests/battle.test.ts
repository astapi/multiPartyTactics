import { describe, expect, it } from "vitest";
import {
  applyDamage,
  applyEffect,
  applyFixedDamage,
  applyHealing,
  applyStatus,
  calculatePhysicalDamage,
  canAct,
  getDamageTakenMultiplier,
  getEffectiveStat,
  getTurnOrder,
  performAction,
  regenerateMp,
  runTurn,
  tickCooldownsOnTurnStart,
  tickEffectsOnTurnStart,
  tickStatusesOnTurnStart,
} from "@/game/battle";
import { makeUnit } from "./helpers";

describe("game/battle", () => {
  it("calculates physical damage with stat/effect modifiers and clamps minimum", () => {
    const attacker = makeUnit({
      stats: { atk: 12 },
      effects: [{ kind: "STAT", id: "atk_up", stat: "atk", amount: 3, remainingTurns: 2, source: "x" }],
    });
    const defender = makeUnit({
      stats: { def: 4 },
      effects: [
        { kind: "STAT", id: "def_down", stat: "def", amount: -2, remainingTurns: 2, source: "x" },
        { kind: "DAMAGE_REDUCTION", id: "shield", multiplier: 0.5, remainingTurns: 2, source: "x" },
      ],
    });

    expect(getEffectiveStat(attacker, "atk")).toBe(15);
    expect(getEffectiveStat(defender, "def")).toBe(2);
    expect(getDamageTakenMultiplier(defender)).toBe(0.5);
    expect(calculatePhysicalDamage(attacker, defender, 2, 1)).toBe(13);
    expect(calculatePhysicalDamage(attacker, defender, -1, 1)).toBe(1);
  });

  it("applies damage/healing with clamping", () => {
    const unit = makeUnit({ hp: 10, stats: { maxHp: 20 } });
    expect(applyDamage(unit, 0)).toBe(0);
    expect(applyDamage(unit, 2.7)).toBe(2);
    expect(unit.hp).toBe(8);
    expect(applyDamage(unit, 999)).toBe(8);
    expect(unit.hp).toBe(0);
    expect(applyFixedDamage(unit, -10)).toBe(0);

    const healerTarget = makeUnit({ hp: 5, stats: { maxHp: 20 } });
    expect(applyHealing(healerTarget, 50)).toBe(15);
    expect(healerTarget.hp).toBe(20);
  });

  it("merges status effects and effect entries correctly", () => {
    const unit = makeUnit();
    applyStatus(unit, { type: "POISON", remainingTurns: 2, potency: 3 });
    applyStatus(unit, { type: "POISON", remainingTurns: 4, potency: 2 });
    applyStatus(unit, { type: "POISON", remainingTurns: 1, potency: 9 });
    applyStatus(unit, { type: "POISON", remainingTurns: 2 });
    applyStatus(unit, { type: "STUN", remainingTurns: 1 });
    applyStatus(unit, { type: "STUN", remainingTurns: 3 });

    expect(unit.statusEffects).toEqual([
      { type: "POISON", remainingTurns: 4, potency: 9 },
      { type: "STUN", remainingTurns: 3 },
    ]);

    applyEffect(unit, {
      kind: "STAT",
      id: "buff",
      stat: "atk",
      amount: 2,
      remainingTurns: 2,
      source: "s1",
    });
    applyEffect(unit, {
      kind: "STAT",
      id: "buff",
      stat: "atk",
      amount: 5,
      remainingTurns: 1,
      source: "s2",
    });
    applyEffect(unit, {
      kind: "STAT",
      id: "buff",
      stat: "atk",
      amount: 1,
      remainingTurns: null,
      source: "s3",
    });
    applyEffect(unit, {
      kind: "DAMAGE_REDUCTION",
      id: "ward",
      multiplier: 0.8,
      remainingTurns: 3,
      source: "s1",
    });
    applyEffect(unit, {
      kind: "DAMAGE_REDUCTION",
      id: "ward",
      multiplier: 0.6,
      remainingTurns: 1,
      source: "s2",
    });

    expect(unit.effects).toContainEqual(
      expect.objectContaining({
        kind: "STAT",
        id: "buff",
        amount: 5,
        remainingTurns: null,
      })
    );
    expect(unit.effects).toContainEqual(
      expect.objectContaining({
        kind: "DAMAGE_REDUCTION",
        id: "ward",
        multiplier: 0.6,
        remainingTurns: 3,
      })
    );
  });

  it("ticks effects, cooldowns, mp, and statuses", () => {
    const unit = makeUnit({
      hp: 20,
      mp: 1,
      stats: { maxHp: 20, maxMp: 5, mpRegen: 3 },
      cooldowns: { a: 2, b: 0 },
      effects: [
        { kind: "STAT", id: "short", stat: "atk", amount: 1, remainingTurns: 1, source: "x" },
        { kind: "STAT", id: "long", stat: "def", amount: 1, remainingTurns: 2, source: "x" },
      ],
      statusEffects: [
        { type: "POISON", remainingTurns: 1, potency: 4 },
        { type: "POISON", remainingTurns: 1 },
        { type: "STUN", remainingTurns: 1 },
      ],
    });

    tickCooldownsOnTurnStart(unit);
    expect(unit.cooldowns).toEqual({ a: 1, b: 0 });
    expect(regenerateMp(unit)).toBe(3);
    expect(unit.mp).toBe(4);
    expect(tickEffectsOnTurnStart(unit)).toEqual(["short"]);
    expect(unit.effects).toHaveLength(1);

    const statusTick = tickStatusesOnTurnStart(unit);
    expect(statusTick).toEqual({
      poisonedDamage: 4,
      skippedAction: true,
      expired: ["STUN", "POISON", "POISON"],
    });
    expect(unit.hp).toBe(16);
    expect(unit.statusEffects).toEqual([]);
    expect(canAct(unit)).toBe(true);
  });

  it("sorts turn order by speed and original order", () => {
    const slow = makeUnit({ id: "slow", order: 3, stats: { spd: 5 } });
    const fastLater = makeUnit({ id: "fast-later", order: 4, stats: { spd: 9 } });
    const fastEarly = makeUnit({ id: "fast-early", order: 1, stats: { spd: 9 } });
    const order = getTurnOrder([slow, fastLater, fastEarly]).map((e) => e.unit.id);
    expect(order).toEqual(["fast-early", "fast-later", "slow"]);
  });

  it("performs WAIT and ATTACK actions", () => {
    const actor = makeUnit({ stats: { atk: 20 } });
    const target = makeUnit({ hp: 12, stats: { def: 1 } });
    const waitResult = performAction(actor, { kind: "WAIT" });
    expect(waitResult.action?.kind).toBe("WAIT");
    expect(waitResult.damageDealt).toBe(0);

    const attackResult = performAction(actor, {
      kind: "ATTACK",
      multiplier: 1,
      target,
      statusToApply: { type: "POISON", remainingTurns: 2, potency: 3 },
    });
    expect(attackResult.damageDealt).toBeGreaterThan(0);
    expect(attackResult.statusApplied).toEqual({ type: "POISON", remainingTurns: 2, potency: 3 });
    expect(target.statusEffects).toContainEqual({ type: "POISON", remainingTurns: 2, potency: 3 });
  });

  it("runs one full turn and covers dead / poisoned death / stun skip / action branches", () => {
    const dead = makeUnit({ id: "dead", hp: 0, stats: { spd: 30 } });
    const poisonDeath = makeUnit({
      id: "poison-death",
      hp: 3,
      stats: { spd: 25 },
      statusEffects: [{ type: "POISON", remainingTurns: 1, potency: 5 }],
    });
    const stunned = makeUnit({
      id: "stunned",
      hp: 20,
      stats: { spd: 20 },
      statusEffects: [{ type: "STUN", remainingTurns: 1 }],
    });
    const actor = makeUnit({
      id: "actor",
      hp: 20,
      mp: 0,
      stats: { spd: 15, maxMp: 10, mpRegen: 2, atk: 15 },
      cooldowns: { skill: 1 },
      effects: [{ kind: "STAT", id: "temp", stat: "atk", amount: 1, remainingTurns: 1, source: "x" }],
    });
    const target = makeUnit({ id: "target", hp: 20, stats: { spd: 1, def: 1 } });

    const results = runTurn([dead, poisonDeath, stunned, actor, target], (current) => {
      if (current.id === "actor") return { kind: "ATTACK", multiplier: 1, target };
      return { kind: "WAIT" };
    });
    const byActor = Object.fromEntries(results.map((r) => [r.actor.id, r]));

    expect(byActor["dead"]).toMatchObject({ skipped: true, action: null });
    expect(byActor["poison-death"]).toMatchObject({
      skipped: true,
      poisonDamage: 5,
      expiredStatuses: ["POISON"],
    });
    expect(poisonDeath.hp).toBe(0);
    expect(byActor["stunned"]).toMatchObject({
      skipped: true,
      poisonDamage: 0,
      expiredStatuses: ["STUN"],
    });
    expect(byActor["actor"]?.action?.kind).toBe("ATTACK");
    expect(byActor["actor"]?.damageDealt).toBeGreaterThan(0);
    expect(actor.mp).toBe(2);
    expect(actor.cooldowns.skill).toBe(0);
    expect(actor.effects).toEqual([]);
    expect(target.hp).toBeLessThan(20);
  });
});
