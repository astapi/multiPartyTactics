import { StatusType, Unit } from "@/game/battle";
import { Skill, isSkillUsable } from "@/game/skills";
import { ConditionType, TargetType, TacticsRuleRecord } from "@/types/models";

type RuleParams = Record<string, unknown>;

const parseParams = (params: string | null): RuleParams => {
  if (!params) return {};
  try {
    return JSON.parse(params);
  } catch {
    return {};
  }
};

const hpPercent = (unit: Unit): number =>
  unit.stats.maxHp > 0 ? unit.hp / unit.stats.maxHp : 0;

const pickLowestHp = (units: Unit[]): Unit | null => {
  if (units.length === 0) return null;
  return units.reduce((prev, cur) => (hpPercent(cur) < hpPercent(prev) ? cur : prev));
};

const hasStatus = (unit: Unit, status: StatusType): boolean =>
  unit.statusEffects.some((effect) => effect.type === status);

const evaluateCondition = (
  actor: Unit,
  allies: Unit[],
  enemies: Unit[],
  turn: number,
  conditionType: ConditionType,
  params: RuleParams
): boolean => {
  switch (conditionType) {
    case "TURN_EQUALS":
      return turn === Number(params.turn ?? -1);
    case "SELF_HP_BELOW":
      return hpPercent(actor) < Number(params.threshold ?? 0);
    case "ALLY_HP_BELOW": {
      const lowest = pickLowestHp(allies);
      return lowest ? hpPercent(lowest) < Number(params.threshold ?? 0) : false;
    }
    case "ENEMY_HP_BELOW": {
      const target = pickLowestHp(enemies);
      return target ? hpPercent(target) < Number(params.threshold ?? 0) : false;
    }
    case "ANY_ALLY_HAS_STATUS":
      return allies.some((ally) => hasStatus(ally, String(params.status ?? "POISON") as StatusType));
    case "ALWAYS":
      return true;
    default:
      return false;
  }
};

const selectTarget = (
  actor: Unit,
  allies: Unit[],
  enemies: Unit[],
  targetType: TargetType,
  params: RuleParams
): Unit | null => {
  switch (targetType) {
    case "SELF":
      return actor;
    case "ALLY_LOWEST_HP":
      return pickLowestHp(allies);
    case "ALLY_WITH_STATUS_LOWEST_HP": {
      const status = String(params.status ?? "POISON") as StatusType;
      const candidates = allies.filter((ally) => hasStatus(ally, status));
      return pickLowestHp(candidates);
    }
    case "ENEMY_FIRST":
      return enemies[0] ?? null;
    case "ENEMY_LOWEST_HP":
      return pickLowestHp(enemies);
    default:
      return null;
  }
};

export type TacticsResolution = {
  skill: Skill | null;
  target: Unit | null;
  evaluatedRuleIds: string[];
};

export const evaluateTactics = (
  actor: Unit,
  allies: Unit[],
  enemies: Unit[],
  rules: TacticsRuleRecord[],
  skillMap: Map<string, Skill>,
  turn: number
): TacticsResolution => {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  const evaluatedRuleIds: string[] = [];

  for (const rule of sorted) {
    evaluatedRuleIds.push(rule.id);
    const skill = skillMap.get(rule.skillId);
    if (!skill || !isSkillUsable(actor, skill)) continue;

    const conditionParams = parseParams(rule.conditionParams);
    const targetParams = parseParams(rule.targetParams);
    const conditionMatched = evaluateCondition(
      actor,
      allies,
      enemies,
      turn,
      rule.conditionType,
      conditionParams
    );
    if (!conditionMatched) continue;

    const target = selectTarget(actor, allies, enemies, rule.targetType, targetParams);
    if (!target) continue;

    return { skill, target, evaluatedRuleIds };
  }

  return { skill: null, target: null, evaluatedRuleIds };
};
