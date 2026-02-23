import { describe, expect, it } from "vitest";
import {
  applySkillCost,
  executeSkill,
  hasEffect,
  isSkillUsable,
  removeStatus,
} from "@/game/skills";
import { makeSkill, makeUnit } from "./helpers";

describe("game/skills/execute", () => {
  it("checks usability and applies skill cost/cooldown", () => {
    const actor = makeUnit({ mp: 5, cooldowns: { fire: 1 } });
    const skill = makeSkill({ id: "fire", mpCost: 6, cooldown: 2, type: "attack" });
    expect(isSkillUsable(actor, skill)).toBe(false);

    actor.mp = 10;
    expect(isSkillUsable(actor, skill)).toBe(false);
    actor.cooldowns.fire = 0;
    expect(isSkillUsable(actor, skill)).toBe(true);

    applySkillCost(actor, skill);
    expect(actor.mp).toBe(4);
    expect(actor.cooldowns.fire).toBe(2);
  });

  it("removes status when present", () => {
    const unit = makeUnit({ statusEffects: [{ type: "POISON", remainingTurns: 2, potency: 1 }] });
    expect(removeStatus(unit, "STUN")).toBe(false);
    expect(removeStatus(unit, "POISON")).toBe(true);
    expect(unit.statusEffects).toEqual([]);
  });

  it("throws if skill is not usable", () => {
    const actor = makeUnit({ mp: 0 });
    const target = makeUnit();
    const skill = makeSkill({ name: "Big Spell", type: "attack", mpCost: 10 });
    expect(() => executeSkill(actor, target, skill, () => 0.5)).toThrow("Skill not usable");
  });

  it("executes attack skill with deterministic rng", () => {
    const actor = makeUnit({ mp: 10, stats: { atk: 20 } });
    const target = makeUnit({ hp: 30, stats: { def: 2 } });
    const skill = makeSkill({
      id: "slash",
      name: "Slash",
      type: "attack",
      mpCost: 3,
      cooldown: 1,
      multiplier: 1.5,
    });

    const result = executeSkill(actor, target, skill, () => 0.5);
    expect(result.action).toEqual({ kind: "ATTACK", multiplier: 1.5, target });
    expect(result.damage).toBeGreaterThan(0);
    expect(result.healing).toBe(0);
    expect(actor.mp).toBe(7);
    expect(actor.cooldowns.slash).toBe(1);
    expect(target.hp).toBeLessThan(30);
  });

  it("executes non-attack skill and applies mixed effects", () => {
    const actor = makeUnit({ mp: 20 });
    const target = makeUnit({
      hp: 40,
      mp: 5,
      stats: { maxHp: 100, maxMp: 20 },
      statusEffects: [{ type: "POISON", remainingTurns: 2, potency: 4 }],
    });
    const skill = makeSkill({
      id: "support_combo",
      name: "Support Combo",
      type: "utility",
      target: "ALLY",
      mpCost: 4,
      cooldown: 2,
      effects: [
        { kind: "BUFF", id: "ATK_UP", stat: "atk", amount: 3, duration: 2 },
        { kind: "DEBUFF", id: "DEF_DOWN", stat: "def", amount: -2, duration: 2 },
        { kind: "DAMAGE_REDUCTION", id: "GUARD", multiplier: 0.7, duration: 2 },
        { kind: "ENRAGE", id: "ENRAGED", atkBonus: 5 },
        { kind: "STATUS", status: "STUN", duration: 1, chance: 1 },
        { kind: "HEAL", amount: 30 },
        { kind: "CLEANSE", status: "POISON" },
        { kind: "MP_RECOVER", amount: 50 },
      ],
    });

    const result = executeSkill(actor, target, skill, () => 0.1);
    expect(result.action).toEqual({ kind: "WAIT" });
    expect(result.damage).toBe(0);
    expect(result.healing).toBe(30);
    expect(result.appliedStatuses).toContainEqual({ type: "STUN", remainingTurns: 1, potency: undefined });
    expect(result.cleansedStatuses).toEqual(["POISON"]);
    expect(result.appliedEffects).toHaveLength(4);
    expect(hasEffect(target, "ATK_UP")).toBe(true);
    expect(hasEffect(target, "DEF_DOWN")).toBe(true);
    expect(hasEffect(target, "GUARD")).toBe(true);
    expect(hasEffect(target, "ENRAGED")).toBe(true);
    expect(target.hp).toBe(70);
    expect(target.mp).toBe(20);
    expect(actor.mp).toBe(16);
    expect(actor.cooldowns.support_combo).toBe(2);
  });

  it("skips status application when chance check fails", () => {
    const actor = makeUnit({ mp: 10 });
    const target = makeUnit();
    const skill = makeSkill({
      id: "weak_poison",
      type: "status",
      effects: [{ kind: "STATUS", status: "POISON", duration: 2, potency: 1, chance: 0.2 }],
    });

    const result = executeSkill(actor, target, skill, () => 0.9);
    expect(result.appliedStatuses).toEqual([]);
    expect(target.statusEffects).toEqual([]);
  });
});
