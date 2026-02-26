import { describe, expect, it } from "vitest";
import { GUARDIAN_SKILLS } from "@/game/skills/guardian";
import { CLERIC_SKILLS } from "@/game/skills/cleric";
import { SWORDMAN_SKILLS, BERSERKER_SKILLS } from "@/game/skills/blade";
import { ARCANE_SKILLS } from "@/game/skills/arcane";
import { THIEF_SKILLS } from "@/game/skills/thief";
import { CLASS_DEFINITIONS } from "@/game/skills/classes";
import { applySkillCost, executeSkill, hasEffect, isSkillUsable, removeStatus } from "@/game/skills/execute";
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
    expect(result.hitCount).toBe(1);
    expect(result.consumedItems).toEqual([]);
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
    expect(result.hitCount).toBe(0);
    expect(result.consumedItems).toEqual([]);
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

  it("applies and consumes next-attack multiplier buff", () => {
    const actor = makeUnit({ mp: 20, stats: { atk: 20 } });
    const targetA = makeUnit({ hp: 100, stats: { def: 0 } });
    const targetB = makeUnit({ hp: 100, stats: { def: 0 } });

    const charge = makeSkill({
      id: "focus",
      type: "buff",
      target: "SELF",
      mpCost: 3,
      effects: [{ kind: "NEXT_ATTACK_MULTIPLIER", id: "FOCUS_NEXT_ATTACK", multiplier: 2.5 }],
    });
    const strike = makeSkill({ id: "slash", type: "attack", multiplier: 1.0 });

    const buffResult = executeSkill(actor, actor, charge, () => 0.5);
    expect(buffResult.appliedEffects).toHaveLength(1);
    expect(hasEffect(actor, "FOCUS_NEXT_ATTACK")).toBe(true);

    const boosted = executeSkill(actor, targetA, strike, () => 0.5);
    expect(boosted.damage).toBeGreaterThan(40);
    expect(hasEffect(actor, "FOCUS_NEXT_ATTACK")).toBe(false);

    const normal = executeSkill(actor, targetB, strike, () => 0.5);
    expect(normal.damage).toBeLessThan(boosted.damage);
  });

  it("supports multi-hit attacks and outgoing damage multiplier buffs", () => {
    const actor = makeUnit({ mp: 20, stats: { atk: 18 } });
    const target = makeUnit({ hp: 200, stats: { def: 2 } });

    const pumpUp = makeSkill({
      id: "pump_up",
      type: "buff",
      target: "SELF",
      effects: [
        { kind: "OUTGOING_DAMAGE_MULTIPLIER", id: "PUMP_UP_DAMAGE", multiplier: 1.2, duration: 3 },
      ],
    });
    const swordDance = makeSkill({
      id: "sword_dance",
      type: "attack",
      hitCount: 4,
      hitMultiplier: 0.5,
    });

    executeSkill(actor, actor, pumpUp, () => 0.5);
    const result = executeSkill(actor, target, swordDance, () => 0.5);
    expect(result.hitCount).toBe(4);
    expect(result.damage).toBeGreaterThan(0);
    expect(hasEffect(actor, "PUMP_UP_DAMAGE")).toBe(true);
  });

  it("supports taunt/cover markers and item consumption", () => {
    const actor = makeUnit({ mp: 0, stats: { maxMp: 20 } });
    actor.mp = 5;
    const ally = makeUnit({
      hp: 40,
      stats: { maxHp: 100, maxMp: 20 },
      statusEffects: [{ type: "POISON", remainingTurns: 2, potency: 2 }],
    });
    const itemStock = { healing_potion: 1, antidote_herb: 1, ether: 1 };

    const taunt = makeSkill({
      id: "taunt",
      type: "utility",
      target: "SELF",
      effects: [{ kind: "TAUNT", id: "TAUNT", duration: 1 }],
    });
    const cover = makeSkill({
      id: "substitute",
      type: "buff",
      target: "SELF",
      effects: [{ kind: "COVER_ALL", id: "COVER_ALL", duration: 1 }],
    });
    const potion = makeSkill({
      id: "healing_potion",
      type: "item",
      target: "ALLY",
      itemCosts: [{ itemId: "healing_potion", amount: 1 }],
      effects: [{ kind: "HEAL", amount: 25 }],
    });
    const herb = makeSkill({
      id: "antidote_herb",
      type: "item",
      target: "ALLY",
      itemCosts: [{ itemId: "antidote_herb", amount: 1 }],
      effects: [{ kind: "CLEANSE", status: "POISON" }],
    });
    const ether = makeSkill({
      id: "ether",
      type: "item",
      target: "ALLY",
      itemCosts: [{ itemId: "ether", amount: 1 }],
      effects: [{ kind: "MP_RECOVER", amount: 10 }],
    });

    executeSkill(actor, actor, taunt, () => 0.5);
    executeSkill(actor, actor, cover, () => 0.5);
    expect(hasEffect(actor, "TAUNT")).toBe(true);
    expect(hasEffect(actor, "COVER_ALL")).toBe(true);

    const potionResult = executeSkill(actor, ally, potion, () => 0.5, { itemStock });
    expect(potionResult.consumedItems).toEqual([{ itemId: "healing_potion", amount: 1 }]);
    expect(itemStock.healing_potion).toBe(0);
    expect(ally.hp).toBe(65);

    const herbResult = executeSkill(actor, ally, herb, () => 0.5, { itemStock });
    expect(herbResult.cleansedStatuses).toEqual(["POISON"]);
    expect(itemStock.antidote_herb).toBe(0);

    const etherResult = executeSkill(actor, ally, ether, () => 0.5, { itemStock });
    expect(etherResult.consumedItems).toEqual([{ itemId: "ether", amount: 1 }]);
    expect(itemStock.ether).toBe(0);
    expect(ally.mp).toBe(20);

    expect(isSkillUsable(actor, potion, { itemStock })).toBe(false);
  });

  it("updates class skill sets to the new class-specific composition", () => {
    expect(GUARDIAN_SKILLS.map((skill) => skill.id)).toEqual(["defend", "taunt", "substitute"]);
    expect(SWORDMAN_SKILLS.map((skill) => skill.id)).toEqual(["focus", "sword_dance", "rift_slash"]);
    expect(BERSERKER_SKILLS.map((skill) => skill.id)).toEqual(["sweep", "crushing_swing", "pump_up"]);
    expect(CLERIC_SKILLS.map((skill) => skill.id)).toEqual(["heal", "all_heal", "defense_up"]);
    expect(THIEF_SKILLS.map((skill) => skill.id)).toEqual(["healing_potion", "antidote_herb", "ether"]);
    expect(ARCANE_SKILLS.map((skill) => skill.id)).toEqual(["lightning", "fireball", "mana_charge"]);

    const skillIdsByClass = Object.fromEntries(
      CLASS_DEFINITIONS.map((entry) => [entry.id, entry.skills.map((skill) => skill.id)])
    );
    expect(skillIdsByClass.GUARDIAN).toEqual(["defend", "taunt", "substitute"]);
    expect(skillIdsByClass.SWORDMAN).toEqual(["focus", "sword_dance", "rift_slash"]);
    expect(skillIdsByClass.BERSERKER).toEqual(["sweep", "crushing_swing", "pump_up"]);
    expect(skillIdsByClass.CLERIC).toEqual(["heal", "all_heal", "defense_up"]);
    expect(skillIdsByClass.WITCH).toEqual(["lightning", "fireball", "mana_charge"]);
    expect(skillIdsByClass.THIEF).toEqual(["healing_potion", "antidote_herb", "ether"]);
  });
});
