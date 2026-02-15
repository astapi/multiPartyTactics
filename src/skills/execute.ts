import {
  Action,
  Effect,
  StatusEffect,
  StatusType,
  Unit,
  applyDamage,
  applyEffect,
  applyHealing,
  applyStatus,
  calculatePhysicalDamage,
} from "../battle";
import { Skill, SkillUseResult } from "./types";

export const getHpPercent = (unit: Unit): number =>
  unit.stats.maxHp === 0 ? 0 : unit.hp / unit.stats.maxHp;

export const hasEffect = (unit: Unit, id: string): boolean =>
  unit.effects.some((effect) => effect.id === id);

export const isSkillUsable = (actor: Unit, skill: Skill): boolean => {
  if (actor.mp < skill.mpCost) {
    return false;
  }
  const remaining = actor.cooldowns[skill.id] ?? 0;
  return remaining <= 0;
};

export const applySkillCost = (actor: Unit, skill: Skill): void => {
  actor.mp = Math.max(0, actor.mp - skill.mpCost);
  if (skill.cooldown > 0) {
    actor.cooldowns[skill.id] = skill.cooldown;
  }
};

export const removeStatus = (unit: Unit, status: StatusType): boolean => {
  const index = unit.statusEffects.findIndex((effect) => effect.type === status);
  if (index < 0) {
    return false;
  }
  unit.statusEffects.splice(index, 1);
  return true;
};

export const executeSkill = (
  actor: Unit,
  target: Unit,
  skill: Skill,
  rng: () => number = Math.random
): SkillUseResult => {
  if (!isSkillUsable(actor, skill)) {
    throw new Error(`Skill not usable: ${skill.name}`);
  }

  applySkillCost(actor, skill);

  let damage = 0;
  let healing = 0;
  const appliedStatuses: StatusEffect[] = [];
  const cleansedStatuses: StatusType[] = [];
  const appliedEffects: Effect[] = [];

  if (skill.type === "attack") {
    const bonusPower =
      skill.conditionalPower &&
      skill.conditionalPower.kind === "TARGET_HP_BELOW" &&
      getHpPercent(target) < skill.conditionalPower.threshold
        ? skill.conditionalPower.bonus
        : 0;
    const power = (skill.power ?? 0) + bonusPower;
    const dealt = applyDamage(target, calculatePhysicalDamage(actor, target, power));
    damage += dealt;
  }

  for (const effect of skill.effects ?? []) {
    if (effect.kind === "BUFF") {
      const entry: Effect = {
        kind: "STAT",
        id: effect.id,
        stat: effect.stat,
        amount: effect.amount,
        remainingTurns: effect.duration,
        source: skill.id,
      };
      applyEffect(target, entry);
      appliedEffects.push(entry);
      continue;
    }

    if (effect.kind === "DEBUFF") {
      const entry: Effect = {
        kind: "STAT",
        id: effect.id,
        stat: effect.stat,
        amount: effect.amount,
        remainingTurns: effect.duration,
        source: skill.id,
      };
      applyEffect(target, entry);
      appliedEffects.push(entry);
      continue;
    }

    if (effect.kind === "DAMAGE_REDUCTION") {
      const entry: Effect = {
        kind: "DAMAGE_REDUCTION",
        id: effect.id,
        multiplier: effect.multiplier,
        remainingTurns: effect.duration,
        source: skill.id,
      };
      applyEffect(target, entry);
      appliedEffects.push(entry);
      continue;
    }

    if (effect.kind === "ENRAGE") {
      const entry: Effect = {
        kind: "STAT",
        id: effect.id,
        stat: "atk",
        amount: effect.atkBonus,
        remainingTurns: null,
        source: skill.id,
      };
      applyEffect(target, entry);
      appliedEffects.push(entry);
      continue;
    }

    if (effect.kind === "STATUS") {
      const chance = effect.chance ?? 1;
      if (rng() <= chance) {
        const status: StatusEffect = {
          type: effect.status,
          remainingTurns: effect.duration,
          potency: effect.potency,
        };
        applyStatus(target, status);
        appliedStatuses.push(status);
      }
      continue;
    }

    if (effect.kind === "HEAL") {
      healing += applyHealing(target, effect.amount);
      continue;
    }

    if (effect.kind === "CLEANSE") {
      if (removeStatus(target, effect.status)) {
        cleansedStatuses.push(effect.status);
      }
      continue;
    }

    if (effect.kind === "MP_RECOVER") {
      target.mp = Math.min(target.stats.maxMp, target.mp + effect.amount);
      continue;
    }
  }

  const action: Action =
    skill.type === "attack"
      ? { kind: "ATTACK", power: skill.power ?? 0, target }
      : { kind: "WAIT" };

  return { action, damage, healing, appliedStatuses, cleansedStatuses, appliedEffects };
};
