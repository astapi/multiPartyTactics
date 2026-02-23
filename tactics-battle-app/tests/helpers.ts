import type { Skill } from "@/game/skills";
import type { TacticsRuleRecord } from "@/types/models";
import type { Unit } from "@/game/battle";

const DEFAULT_STATS: Unit["stats"] = {
  maxHp: 100,
  atk: 10,
  def: 5,
  spd: 10,
  maxMp: 20,
  mpRegen: 2,
};

let seq = 0;

export const makeUnit = (
  overrides: Partial<Unit> & { stats?: Partial<Unit["stats"]> } = {}
): Unit => {
  seq += 1;
  const stats: Unit["stats"] = { ...DEFAULT_STATS, ...(overrides.stats ?? {}) };
  return {
    id: overrides.id ?? `unit-${seq}`,
    name: overrides.name ?? `Unit ${seq}`,
    stats,
    hp: overrides.hp ?? stats.maxHp,
    mp: overrides.mp ?? stats.maxMp,
    statusEffects: (overrides.statusEffects ?? []).map((status) => ({ ...status })),
    effects: (overrides.effects ?? []).map((effect) => ({ ...effect })),
    cooldowns: { ...(overrides.cooldowns ?? {}) },
    classId: overrides.classId,
    order: overrides.order ?? seq,
  };
};

export const cloneUnit = (unit: Unit): Unit => makeUnit(unit);

export const makeSkill = (overrides: Partial<Skill> = {}): Skill => ({
  id: overrides.id ?? `skill-${seq}`,
  name: overrides.name ?? "Test Skill",
  type: overrides.type ?? "attack",
  target: overrides.target ?? "ENEMY",
  mpCost: overrides.mpCost ?? 0,
  cooldown: overrides.cooldown ?? 0,
  multiplier: overrides.multiplier,
  effects: overrides.effects ? [...overrides.effects] : overrides.effects,
  tags: overrides.tags ?? [],
});

export const makeRule = (
  overrides: Partial<TacticsRuleRecord> = {}
): TacticsRuleRecord => ({
  id: overrides.id ?? `rule-${seq}`,
  characterId: overrides.characterId ?? "actor-1",
  priority: overrides.priority ?? 1,
  skillId: overrides.skillId ?? "skill-1",
  conditionType: overrides.conditionType ?? "ALWAYS",
  conditionParams: overrides.conditionParams ?? null,
  targetType: overrides.targetType ?? "ENEMY_FIRST",
  targetParams: overrides.targetParams ?? null,
});
