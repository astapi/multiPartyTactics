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
  getOutgoingDamageMultiplier,
} from "../battle";
import { Skill, SkillExecutionContext, SkillItemCost, SkillUseResult } from "./types";

export const getHpPercent = (unit: Unit): number =>
  unit.stats.maxHp === 0 ? 0 : unit.hp / unit.stats.maxHp;

export const hasEffect = (unit: Unit, id: string): boolean =>
  unit.effects.some((effect) => effect.id === id);

const hasEnoughItems = (skill: Skill, context?: SkillExecutionContext): boolean => {
  if (!skill.itemCosts?.length || !context?.itemStock) {
    return true;
  }

  return skill.itemCosts.every((cost) => (context.itemStock?.[cost.itemId] ?? 0) >= cost.amount);
};

export const isSkillUsable = (
  actor: Unit,
  skill: Skill,
  context?: SkillExecutionContext
): boolean => {
  if (actor.mp < skill.mpCost) {
    return false;
  }
  if (!hasEnoughItems(skill, context)) {
    return false;
  }
  const remaining = actor.cooldowns[skill.id] ?? 0;
  return remaining <= 0;
};

export const applySkillCost = (
  actor: Unit,
  skill: Skill,
  context?: SkillExecutionContext
): SkillItemCost[] => {
  actor.mp = Math.max(0, actor.mp - skill.mpCost);
  if (skill.cooldown > 0) {
    actor.cooldowns[skill.id] = skill.cooldown;
  }

  const consumedItems: SkillItemCost[] = [];
  if (context?.itemStock && skill.itemCosts?.length) {
    for (const cost of skill.itemCosts) {
      context.itemStock[cost.itemId] = Math.max(0, (context.itemStock[cost.itemId] ?? 0) - cost.amount);
      consumedItems.push({ ...cost });
    }
  }

  return consumedItems;
};

export const removeStatus = (unit: Unit, status: StatusType): boolean => {
  const index = unit.statusEffects.findIndex((effect) => effect.type === status);
  if (index < 0) {
    return false;
  }
  unit.statusEffects.splice(index, 1);
  return true;
};

const getAliveUnits = (units?: Unit[]): Unit[] => (units ?? []).filter((unit) => unit.hp > 0);

const pickTaunter = (units: Unit[]): Unit | null =>
  units.find((unit) => hasEffect(unit, "TAUNT")) ?? null;

const pickCoverAll = (units: Unit[]): Unit | null =>
  units.find((unit) => hasEffect(unit, "COVER_ALL")) ?? null;

const redirectAttackTarget = (requestedTarget: Unit, defenders: Unit[]): Unit => {
  const aliveDefenders = getAliveUnits(defenders);
  if (aliveDefenders.length === 0) return requestedTarget;

  const taunter = pickTaunter(aliveDefenders);
  const tauntTarget = taunter ?? requestedTarget;

  const cover = pickCoverAll(aliveDefenders);
  if (cover && cover.id !== tauntTarget.id) {
    return cover;
  }

  return tauntTarget;
};

const resolveEffectTargets = (
  target: Unit,
  skill: Skill,
  context?: SkillExecutionContext
): Unit[] => {
  if (skill.area === "ALLY_ALL") {
    const allies = getAliveUnits(context?.allies);
    return allies.length > 0 ? allies : [target];
  }

  if (skill.area === "ALL_ENEMIES" || skill.area === "ENEMY_ROW") {
    const opponents = getAliveUnits(context?.opponents);
    return opponents.length > 0 ? opponents : [target];
  }

  return [target];
};

const resolveAttackHitTargets = (
  target: Unit,
  skill: Skill,
  rng: () => number,
  context?: SkillExecutionContext
): Unit[] => {
  const hits = Math.max(1, skill.hitCount ?? 1);
  const opponents = getAliveUnits(context?.opponents);
  const attackTargets: Unit[] = [];

  if (skill.area === "ALL_ENEMIES" || skill.area === "ENEMY_ROW") {
    const baseTargets = opponents.length > 0 ? opponents : [target];
    for (const unit of baseTargets) {
      attackTargets.push(redirectAttackTarget(unit, baseTargets));
    }
    return attackTargets;
  }

  if (skill.area === "RANDOM_ENEMY" && skill.randomizeTargetPerHit) {
    const candidates = opponents.length > 0 ? opponents : [target];
    for (let i = 0; i < hits; i += 1) {
      const aliveCandidates = candidates.filter((unit) => unit.hp > 0);
      if (aliveCandidates.length === 0) break;
      const picked = aliveCandidates[Math.floor(rng() * aliveCandidates.length)];
      attackTargets.push(redirectAttackTarget(picked, candidates));
    }
    return attackTargets;
  }

  const defenders = opponents.length > 0 ? opponents : [target];
  for (let i = 0; i < hits; i += 1) {
    const resolved = redirectAttackTarget(target, defenders);
    if (resolved.hp <= 0) break;
    attackTargets.push(resolved);
  }
  return attackTargets;
};

export const executeSkill = (
  actor: Unit,
  target: Unit,
  skill: Skill,
  rng: () => number = Math.random,
  context?: SkillExecutionContext
): SkillUseResult => {
  if (!isSkillUsable(actor, skill, context)) {
    throw new Error(`Skill not usable: ${skill.name}`);
  }

  const consumedItems = applySkillCost(actor, skill, context);

  let damage = 0;
  let healing = 0;
  const appliedStatuses: StatusEffect[] = [];
  const cleansedStatuses: StatusType[] = [];
  const appliedEffects: Effect[] = [];
  let hitCount = 0;
  const resolvedTargetIds = new Set<string>();
  const effectTargets = resolveEffectTargets(target, skill, context);

  if (skill.type === "attack") {
    const nextAttackEffects = actor.effects.filter(
      (effect): effect is Extract<Effect, { kind: "NEXT_ATTACK_MULTIPLIER" }> =>
        effect.kind === "NEXT_ATTACK_MULTIPLIER"
    );
    const nextAttackMultiplier = nextAttackEffects.reduce(
      (multiplier, effect) => multiplier * effect.multiplier,
      1
    );
    const outgoingMultiplier = getOutgoingDamageMultiplier(actor);
    const perHitMultiplier = (skill.hitMultiplier ?? skill.multiplier ?? 1) * nextAttackMultiplier * outgoingMultiplier;
    const attackTargets = resolveAttackHitTargets(target, skill, rng, context);

    for (const attackTarget of attackTargets) {
      if (attackTarget.hp <= 0) continue;
      const randomFactor = 0.98 + rng() * 0.04;
      const dealt = applyDamage(
        attackTarget,
        calculatePhysicalDamage(actor, attackTarget, perHitMultiplier, randomFactor)
      );
      damage += dealt;
      hitCount += 1;
      resolvedTargetIds.add(attackTarget.id);
    }

    if (nextAttackEffects.length > 0 && hitCount > 0) {
      actor.effects = actor.effects.filter((effect) => effect.kind !== "NEXT_ATTACK_MULTIPLIER");
    }
  }

  for (const effect of skill.effects ?? []) {
    for (const effectTarget of effectTargets) {
    if (effect.kind === "BUFF") {
      const entry: Effect = {
        kind: "STAT",
        id: effect.id,
        stat: effect.stat,
        amount: effect.amount,
        remainingTurns: effect.duration,
        source: skill.id,
      };
      applyEffect(effectTarget, entry);
      appliedEffects.push(entry);
      resolvedTargetIds.add(effectTarget.id);
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
      applyEffect(effectTarget, entry);
      appliedEffects.push(entry);
      resolvedTargetIds.add(effectTarget.id);
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
      applyEffect(effectTarget, entry);
      appliedEffects.push(entry);
      resolvedTargetIds.add(effectTarget.id);
      continue;
    }

    if (effect.kind === "OUTGOING_DAMAGE_MULTIPLIER") {
      const entry: Effect = {
        kind: "OUTGOING_DAMAGE_MULTIPLIER",
        id: effect.id,
        multiplier: effect.multiplier,
        remainingTurns: effect.duration,
        source: skill.id,
      };
      applyEffect(effectTarget, entry);
      appliedEffects.push(entry);
      resolvedTargetIds.add(effectTarget.id);
      continue;
    }

    if (effect.kind === "NEXT_ATTACK_MULTIPLIER") {
      const entry: Effect = {
        kind: "NEXT_ATTACK_MULTIPLIER",
        id: effect.id,
        multiplier: effect.multiplier,
        remainingTurns: null,
        source: skill.id,
      };
      applyEffect(effectTarget, entry);
      appliedEffects.push(entry);
      resolvedTargetIds.add(effectTarget.id);
      continue;
    }

    if (effect.kind === "TAUNT") {
      const entry: Effect = {
        kind: "TAUNT",
        id: effect.id,
        remainingTurns: effect.duration,
        source: skill.id,
      };
      applyEffect(effectTarget, entry);
      appliedEffects.push(entry);
      resolvedTargetIds.add(effectTarget.id);
      continue;
    }

    if (effect.kind === "COVER_ALL") {
      const entry: Effect = {
        kind: "COVER_ALL",
        id: effect.id,
        remainingTurns: effect.duration,
        source: skill.id,
      };
      applyEffect(effectTarget, entry);
      appliedEffects.push(entry);
      resolvedTargetIds.add(effectTarget.id);
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
      applyEffect(effectTarget, entry);
      appliedEffects.push(entry);
      resolvedTargetIds.add(effectTarget.id);
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
        applyStatus(effectTarget, status);
        appliedStatuses.push(status);
        resolvedTargetIds.add(effectTarget.id);
      }
      continue;
    }

    if (effect.kind === "HEAL") {
      healing += applyHealing(effectTarget, effect.amount);
      resolvedTargetIds.add(effectTarget.id);
      continue;
    }

    if (effect.kind === "HEAL_MULTIPLIER") {
      const amount = Math.max(1, Math.floor(actor.stats.atk * effect.multiplier));
      healing += applyHealing(effectTarget, amount);
      resolvedTargetIds.add(effectTarget.id);
      continue;
    }

    if (effect.kind === "CLEANSE") {
      if (removeStatus(effectTarget, effect.status)) {
        cleansedStatuses.push(effect.status);
        resolvedTargetIds.add(effectTarget.id);
      }
      continue;
    }

    if (effect.kind === "MP_RECOVER") {
      effectTarget.mp = Math.min(effectTarget.stats.maxMp, effectTarget.mp + effect.amount);
      resolvedTargetIds.add(effectTarget.id);
      continue;
    }
    }
  }

  const actionTarget = effectTargets[0] ?? target;
  const action: Action =
    skill.type === "attack"
      ? { kind: "ATTACK", multiplier: skill.hitMultiplier ?? skill.multiplier ?? 1, target: actionTarget }
      : { kind: "WAIT" };

  return {
    action,
    damage,
    healing,
    appliedStatuses,
    cleansedStatuses,
    appliedEffects,
    hitCount,
    consumedItems,
    resolvedTargetIds: [...resolvedTargetIds],
  };
};
