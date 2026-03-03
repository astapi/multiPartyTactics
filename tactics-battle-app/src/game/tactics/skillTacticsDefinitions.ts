import type { Skill } from "@/game/skills/types";
import type { ConditionType, TargetType, TacticsRuleRecord } from "@/types/models";

export type TacticsParamField = "turn" | "threshold" | "status" | "position" | "count";

type ParamSchema = {
  fields: TacticsParamField[];
};

type RulePreset = {
  type: ConditionType | TargetType;
  params: Record<string, unknown> | null;
};

export type SkillTacticsDefinition = {
  skillId: string;
  allowedConditions: ConditionType[];
  defaultCondition: {
    type: ConditionType;
    params: Record<string, unknown> | null;
  };
  allowedTargets: TargetType[];
  defaultTarget: {
    type: TargetType;
    params: Record<string, unknown> | null;
  };
  paramSchema: {
    condition: Partial<Record<ConditionType, ParamSchema>>;
    target: Partial<Record<TargetType, ParamSchema>>;
  };
};

export type RuleValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

const CONDITION_PARAM_FIELDS: Record<ConditionType, TacticsParamField[]> = {
  TURN_EQUALS: ["turn"],
  BOSS_BATTLE: [],
  ENEMY_COUNT_AT_LEAST: ["count"],
  SELF_HP_BELOW: ["threshold"],
  SELF_HP_ABOVE: ["threshold"],
  ALLY_HP_BELOW: ["threshold"],
  ALLY_MP_BELOW: ["threshold"],
  ANY_ALLY_HAS_STATUS: ["status"],
  ALL_OF: [],
  ALWAYS: [],
};

const TARGET_PARAM_FIELDS: Record<TargetType, TacticsParamField[]> = {
  AUTO: [],
  SELF: [],
  ALLY_LOWEST_HP: [],
  ALLY_FIRST_MATCHING_CONDITION: [],
  ALLY_WITH_STATUS_LOWEST_HP: ["status"],
  ALLY_POSITION: ["position"],
};

const stringifyParams = (value: Record<string, unknown> | null): string | null =>
  value ? JSON.stringify(value) : null;

const parseObject = (value: string | null): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
};

const normalizeNumber = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeInteger = (value: unknown): number | null => {
  const n = normalizeNumber(value);
  if (n == null || !Number.isInteger(n) || n < 1) return null;
  return n;
};

const normalizeThreshold = (value: unknown): number | null => {
  const n = normalizeNumber(value);
  if (n == null || n < 0 || n > 1) return null;
  return n;
};

const normalizeStatus = (value: unknown): string | null => {
  const raw = String(value ?? "").trim().toUpperCase();
  return raw.length > 0 ? raw : null;
};

const buildParamSchema = (
  allowedConditions: ConditionType[],
  allowedTargets: TargetType[]
): SkillTacticsDefinition["paramSchema"] => ({
  condition: Object.fromEntries(
    allowedConditions.map((type) => [type, { fields: CONDITION_PARAM_FIELDS[type] }])
  ) as SkillTacticsDefinition["paramSchema"]["condition"],
  target: Object.fromEntries(
    allowedTargets.map((type) => [type, { fields: TARGET_PARAM_FIELDS[type] }])
  ) as SkillTacticsDefinition["paramSchema"]["target"],
});

const createDefinition = (args: {
  skillId: string;
  allowedConditions: ConditionType[];
  defaultCondition: RulePreset;
  allowedTargets: TargetType[];
  defaultTarget: RulePreset;
}): SkillTacticsDefinition => ({
  skillId: args.skillId,
  allowedConditions: args.allowedConditions,
  defaultCondition: {
    type: args.defaultCondition.type as ConditionType,
    params: args.defaultCondition.params,
  },
  allowedTargets: args.allowedTargets,
  defaultTarget: {
    type: args.defaultTarget.type as TargetType,
    params: args.defaultTarget.params,
  },
  paramSchema: buildParamSchema(args.allowedConditions, args.allowedTargets),
});

const DEFINITION_LIST: SkillTacticsDefinition[] = [
  createDefinition({
    skillId: "defend",
    allowedConditions: ["ALWAYS", "SELF_HP_ABOVE"],
    defaultCondition: { type: "ALWAYS", params: null },
    allowedTargets: ["SELF"],
    defaultTarget: { type: "SELF", params: null },
  }),
  createDefinition({
    skillId: "taunt",
    allowedConditions: ["ALWAYS", "SELF_HP_ABOVE"],
    defaultCondition: { type: "ALWAYS", params: null },
    allowedTargets: ["SELF"],
    defaultTarget: { type: "SELF", params: null },
  }),
  createDefinition({
    skillId: "substitute",
    allowedConditions: ["ALLY_HP_BELOW"],
    defaultCondition: { type: "ALLY_HP_BELOW", params: { threshold: 0.25 } },
    allowedTargets: ["SELF"],
    defaultTarget: { type: "SELF", params: null },
  }),
  createDefinition({
    skillId: "focus",
    allowedConditions: ["BOSS_BATTLE", "ALWAYS"],
    defaultCondition: { type: "BOSS_BATTLE", params: null },
    allowedTargets: ["SELF"],
    defaultTarget: { type: "SELF", params: null },
  }),
  createDefinition({
    skillId: "sword_dance",
    allowedConditions: ["ALWAYS"],
    defaultCondition: { type: "ALWAYS", params: null },
    allowedTargets: ["AUTO"],
    defaultTarget: { type: "AUTO", params: null },
  }),
  createDefinition({
    skillId: "rift_slash",
    allowedConditions: ["ALWAYS"],
    defaultCondition: { type: "ALWAYS", params: null },
    allowedTargets: ["AUTO"],
    defaultTarget: { type: "AUTO", params: null },
  }),
  createDefinition({
    skillId: "sweep",
    allowedConditions: ["ENEMY_COUNT_AT_LEAST"],
    defaultCondition: { type: "ENEMY_COUNT_AT_LEAST", params: { count: 2 } },
    allowedTargets: ["AUTO"],
    defaultTarget: { type: "AUTO", params: null },
  }),
  createDefinition({
    skillId: "crushing_swing",
    allowedConditions: ["ALWAYS"],
    defaultCondition: { type: "ALWAYS", params: null },
    allowedTargets: ["AUTO"],
    defaultTarget: { type: "AUTO", params: null },
  }),
  createDefinition({
    skillId: "pump_up",
    allowedConditions: ["BOSS_BATTLE", "ALWAYS", "SELF_HP_ABOVE"],
    defaultCondition: { type: "BOSS_BATTLE", params: null },
    allowedTargets: ["SELF"],
    defaultTarget: { type: "SELF", params: null },
  }),
  createDefinition({
    skillId: "heal",
    allowedConditions: ["ALLY_HP_BELOW"],
    defaultCondition: { type: "ALLY_HP_BELOW", params: { threshold: 0.3 } },
    allowedTargets: ["ALLY_FIRST_MATCHING_CONDITION", "ALLY_LOWEST_HP"],
    defaultTarget: { type: "ALLY_LOWEST_HP", params: null },
  }),
  createDefinition({
    skillId: "all_heal",
    allowedConditions: ["ALLY_HP_BELOW"],
    defaultCondition: { type: "ALLY_HP_BELOW", params: { threshold: 0.6 } },
    allowedTargets: ["ALLY_FIRST_MATCHING_CONDITION", "ALLY_LOWEST_HP"],
    defaultTarget: { type: "ALLY_LOWEST_HP", params: null },
  }),
  createDefinition({
    skillId: "defense_up",
    allowedConditions: ["BOSS_BATTLE", "ALLY_HP_BELOW", "ALWAYS"],
    defaultCondition: { type: "BOSS_BATTLE", params: null },
    allowedTargets: ["ALLY_FIRST_MATCHING_CONDITION", "ALLY_LOWEST_HP"],
    defaultTarget: { type: "ALLY_LOWEST_HP", params: null },
  }),
  createDefinition({
    skillId: "healing_potion",
    allowedConditions: ["ALLY_HP_BELOW"],
    defaultCondition: { type: "ALLY_HP_BELOW", params: { threshold: 0.35 } },
    allowedTargets: ["ALLY_FIRST_MATCHING_CONDITION", "ALLY_LOWEST_HP"],
    defaultTarget: { type: "ALLY_LOWEST_HP", params: null },
  }),
  createDefinition({
    skillId: "antidote_herb",
    allowedConditions: ["ANY_ALLY_HAS_STATUS"],
    defaultCondition: { type: "ANY_ALLY_HAS_STATUS", params: { status: "POISON" } },
    allowedTargets: ["ALLY_FIRST_MATCHING_CONDITION", "ALLY_WITH_STATUS_LOWEST_HP"],
    defaultTarget: { type: "ALLY_WITH_STATUS_LOWEST_HP", params: { status: "POISON" } },
  }),
  createDefinition({
    skillId: "ether",
    allowedConditions: ["ALLY_MP_BELOW"],
    defaultCondition: { type: "ALLY_MP_BELOW", params: { threshold: 0.3 } },
    allowedTargets: ["ALLY_FIRST_MATCHING_CONDITION"],
    defaultTarget: { type: "ALLY_FIRST_MATCHING_CONDITION", params: null },
  }),
  createDefinition({
    skillId: "lightning",
    allowedConditions: ["ALWAYS"],
    defaultCondition: { type: "ALWAYS", params: null },
    allowedTargets: ["AUTO"],
    defaultTarget: { type: "AUTO", params: null },
  }),
  createDefinition({
    skillId: "fireball",
    allowedConditions: ["ALWAYS"],
    defaultCondition: { type: "ALWAYS", params: null },
    allowedTargets: ["AUTO"],
    defaultTarget: { type: "AUTO", params: null },
  }),
  createDefinition({
    skillId: "mana_charge",
    allowedConditions: ["BOSS_BATTLE", "ALWAYS"],
    defaultCondition: { type: "BOSS_BATTLE", params: null },
    allowedTargets: ["SELF"],
    defaultTarget: { type: "SELF", params: null },
  }),
];

const DEFINITION_MAP = new Map(DEFINITION_LIST.map((definition) => [definition.skillId, definition]));

const fallbackTargetBySkillTarget = (target?: Skill["target"]): TargetType => {
  if (target === "SELF") return "SELF";
  if (target === "ALLY") return "ALLY_LOWEST_HP";
  return "AUTO";
};

const createFallbackDefinition = (
  skillId: string,
  fallbackSkillTarget?: Skill["target"]
): SkillTacticsDefinition => {
  const target = fallbackTargetBySkillTarget(fallbackSkillTarget);
  return createDefinition({
    skillId,
    allowedConditions: ["ALWAYS"],
    defaultCondition: { type: "ALWAYS", params: null },
    allowedTargets: [target],
    defaultTarget: { type: target, params: null },
  });
};

const normalizeParamsBySchema = (
  rawParams: Record<string, unknown>,
  schema?: ParamSchema
): { ok: true; params: Record<string, unknown> | null } | { ok: false; reason: string } => {
  if (!schema || schema.fields.length === 0) {
    return { ok: true, params: null };
  }

  const normalized: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (field === "turn") {
      const turn = normalizeInteger(rawParams.turn);
      if (turn == null) return { ok: false, reason: "turn:integer" };
      normalized.turn = turn;
      continue;
    }
    if (field === "threshold") {
      const threshold = normalizeThreshold(rawParams.threshold);
      if (threshold == null) return { ok: false, reason: "threshold:range" };
      normalized.threshold = threshold;
      continue;
    }
    if (field === "status") {
      const status = normalizeStatus(rawParams.status);
      if (!status) return { ok: false, reason: "status:required" };
      normalized.status = status;
      continue;
    }
    if (field === "position") {
      const position = normalizeInteger(rawParams.position);
      if (position == null) return { ok: false, reason: "position:integer" };
      normalized.position = position;
      continue;
    }
    if (field === "count") {
      const count = normalizeInteger(rawParams.count);
      if (count == null) return { ok: false, reason: "count:integer" };
      normalized.count = count;
    }
  }
  return { ok: true, params: normalized };
};

export const SKILL_TACTICS_DEFINITIONS: ReadonlyArray<SkillTacticsDefinition> = DEFINITION_LIST;

export const getSkillTacticsDefinition = (
  skillId: string,
  fallbackSkillTarget?: Skill["target"]
): SkillTacticsDefinition =>
  DEFINITION_MAP.get(skillId) ?? createFallbackDefinition(skillId, fallbackSkillTarget);

export const validateRuleAgainstSkillDefinition = (
  rule: Pick<TacticsRuleRecord, "conditionType" | "conditionParams" | "targetType" | "targetParams">,
  definition: SkillTacticsDefinition
): RuleValidationResult => {
  if (!definition.allowedConditions.includes(rule.conditionType)) {
    return { ok: false, reason: "condition_type:not_allowed" };
  }
  if (!definition.allowedTargets.includes(rule.targetType)) {
    return { ok: false, reason: "target_type:not_allowed" };
  }

  const conditionSchema = definition.paramSchema.condition[rule.conditionType];
  const conditionParams = parseObject(rule.conditionParams);
  const conditionResult = normalizeParamsBySchema(conditionParams, conditionSchema);
  if (!conditionResult.ok) return { ok: false, reason: conditionResult.reason };

  const targetSchema = definition.paramSchema.target[rule.targetType];
  const targetParams = parseObject(rule.targetParams);
  const targetResult = normalizeParamsBySchema(targetParams, targetSchema);
  if (!targetResult.ok) return { ok: false, reason: targetResult.reason };

  return { ok: true };
};

export const coerceRuleToSkillDefinition = (
  rule: TacticsRuleRecord,
  definition: SkillTacticsDefinition
): TacticsRuleRecord => {
  const conditionType = definition.allowedConditions.includes(rule.conditionType)
    ? rule.conditionType
    : definition.defaultCondition.type;
  const targetType = definition.allowedTargets.includes(rule.targetType)
    ? rule.targetType
    : definition.defaultTarget.type;

  const conditionSchema = definition.paramSchema.condition[conditionType];
  const parsedCondition = parseObject(rule.conditionParams);
  const normalizedCondition = normalizeParamsBySchema(parsedCondition, conditionSchema);
  const conditionParams = normalizedCondition.ok
    ? stringifyParams(normalizedCondition.params)
    : stringifyParams(
        definition.defaultCondition.type === conditionType ? definition.defaultCondition.params : null
      );

  const targetSchema = definition.paramSchema.target[targetType];
  const parsedTarget = parseObject(rule.targetParams);
  const normalizedTarget = normalizeParamsBySchema(parsedTarget, targetSchema);
  const targetParams = normalizedTarget.ok
    ? stringifyParams(normalizedTarget.params)
    : stringifyParams(definition.defaultTarget.type === targetType ? definition.defaultTarget.params : null);

  return {
    ...rule,
    conditionType,
    conditionParams,
    targetType,
    targetParams,
  };
};
