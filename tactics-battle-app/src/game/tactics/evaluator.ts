import { StatusType, Unit } from "@/game/battle";
import type { Skill } from "@/game/skills/types";
import { isSkillUsable } from "@/game/skills/execute";
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

const mpPercent = (unit: Unit): number =>
  unit.stats.maxMp > 0 ? unit.mp / unit.stats.maxMp : 0;

const pickLowestHp = (units: Unit[]): Unit | null => {
  if (units.length === 0) return null;
  return units.reduce((prev, cur) => (hpPercent(cur) < hpPercent(prev) ? cur : prev));
};

const pickLowestMp = (units: Unit[]): Unit | null => {
  if (units.length === 0) return null;
  return units.reduce((prev, cur) => (mpPercent(cur) < mpPercent(prev) ? cur : prev));
};

const pickByFormationPosition = (units: Unit[], position: number): Unit | null => {
  if (units.length === 0) return null;
  const sorted = [...units].sort((a, b) => a.order - b.order);
  const index = Math.max(0, Math.floor(position) - 1);
  return sorted[index] ?? null;
};

const hasStatus = (unit: Unit, status: StatusType): boolean =>
  unit.statusEffects.some((effect) => effect.type === status);

type NestedCondition = {
  type?: unknown;
  params?: unknown;
};

const isBossBattle = (enemies: Unit[]): boolean =>
  enemies.some((enemy) => enemy.id.includes("boss_"));

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
    case "BOSS_BATTLE":
      return isBossBattle(enemies);
    case "ENEMY_COUNT_AT_LEAST":
      return enemies.length >= Number(params.count ?? 1);
    case "SELF_HP_BELOW":
      return hpPercent(actor) <= Number(params.threshold ?? 0);
    case "SELF_HP_ABOVE":
      return hpPercent(actor) >= Number(params.threshold ?? 0);
    case "ALLY_HP_BELOW": {
      const lowest = pickLowestHp(allies);
      return lowest ? hpPercent(lowest) <= Number(params.threshold ?? 0) : false;
    }
    case "ALLY_MP_BELOW": {
      const lowest = pickLowestMp(allies);
      return lowest ? mpPercent(lowest) <= Number(params.threshold ?? 0) : false;
    }
    case "ANY_ALLY_HAS_STATUS":
      return allies.some((ally) => hasStatus(ally, String(params.status ?? "POISON") as StatusType));
    case "ALL_OF": {
      const raw = Array.isArray(params.conditions) ? (params.conditions as NestedCondition[]) : [];
      if (raw.length === 0) return false;
      return raw.every((entry) =>
        evaluateCondition(
          actor,
          allies,
          enemies,
          turn,
          String(entry.type ?? "") as ConditionType,
          (entry.params ?? {}) as RuleParams
        )
      );
    }
    case "ALWAYS":
      return true;
    default:
      return false;
  }
};

const matchesConditionForAllyCandidate = (
  ally: Unit,
  turn: number,
  conditionType: ConditionType,
  params: RuleParams,
  enemies: Unit[]
): boolean => {
  switch (conditionType) {
    case "TURN_EQUALS":
      return turn === Number(params.turn ?? -1);
    case "BOSS_BATTLE":
      return isBossBattle(enemies);
    case "ENEMY_COUNT_AT_LEAST":
      return enemies.length >= Number(params.count ?? 1);
    case "SELF_HP_BELOW":
    case "ALLY_HP_BELOW":
      return hpPercent(ally) <= Number(params.threshold ?? 0);
    case "SELF_HP_ABOVE":
      return hpPercent(ally) >= Number(params.threshold ?? 0);
    case "ALLY_MP_BELOW":
      return mpPercent(ally) <= Number(params.threshold ?? 0);
    case "ANY_ALLY_HAS_STATUS":
      return hasStatus(ally, String(params.status ?? "POISON") as StatusType);
    case "ALL_OF": {
      const raw = Array.isArray(params.conditions) ? (params.conditions as NestedCondition[]) : [];
      if (raw.length === 0) return false;
      return raw.every((entry) =>
        matchesConditionForAllyCandidate(
          ally,
          turn,
          String(entry.type ?? "") as ConditionType,
          (entry.params ?? {}) as RuleParams,
          enemies
        )
      );
    }
    case "ALWAYS":
      return true;
    default:
      return false;
  }
};

const pickFirstMatchingAllyByCondition = (
  allies: Unit[],
  enemies: Unit[],
  turn: number,
  conditionType: ConditionType,
  conditionParams: RuleParams
): Unit | null => {
  const sorted = [...allies].sort((a, b) => a.order - b.order);
  return (
    sorted.find((ally) =>
      matchesConditionForAllyCandidate(ally, turn, conditionType, conditionParams, enemies)
    ) ?? null
  );
};

const selectTarget = (
  actor: Unit,
  allies: Unit[],
  enemies: Unit[],
  targetType: TargetType,
  params: RuleParams,
  skillTarget: Skill["target"],
  turn: number,
  conditionType: ConditionType,
  conditionParams: RuleParams
): Unit | null => {
  switch (targetType) {
    case "AUTO":
      if (skillTarget === "SELF") return actor;
      if (skillTarget === "ALLY") return pickLowestHp(allies);
      return enemies[0] ?? null;
    case "SELF":
      return actor;
    case "ALLY_LOWEST_HP":
      return pickLowestHp(allies);
    case "ALLY_FIRST_MATCHING_CONDITION":
      return pickFirstMatchingAllyByCondition(
        allies,
        enemies,
        turn,
        conditionType,
        conditionParams
      );
    case "ALLY_WITH_STATUS_LOWEST_HP": {
      const status = String(params.status ?? "POISON") as StatusType;
      const candidates = allies.filter((ally) => hasStatus(ally, status));
      return pickLowestHp(candidates);
    }
    case "ALLY_POSITION":
      return pickByFormationPosition(allies, Number(params.position ?? 1));
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

    const target = selectTarget(
      actor,
      allies,
      enemies,
      rule.targetType,
      targetParams,
      skill.target,
      turn,
      rule.conditionType,
      conditionParams
    );
    if (!target) continue;

    return { skill, target, evaluatedRuleIds };
  }

  return { skill: null, target: null, evaluatedRuleIds };
};
