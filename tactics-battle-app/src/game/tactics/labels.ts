import { getSkillNameKey } from "@/game/skills/labels";
import type { TranslationKey } from "@/i18n";
import type { ConditionType, TacticsRuleRecord, TargetType } from "@/types/models";

type TFunc = (key: TranslationKey, params?: Record<string, string | number>) => string;

const parseParams = (value: string | null): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export const getSkillIdDisplayName = (skillId: string, t: TFunc): string => {
  const key = getSkillNameKey(skillId);
  return key ? t(key) : skillId;
};

const CONDITION_KEYS: Record<ConditionType, TranslationKey> = {
  TURN_EQUALS: "tactics.condition.turn_equals",
  BOSS_BATTLE: "tactics.condition.boss_battle",
  ENEMY_COUNT_AT_LEAST: "tactics.condition.enemy_count_at_least",
  SELF_HP_BELOW: "tactics.condition.self_hp_below",
  SELF_HP_ABOVE: "tactics.condition.self_hp_above",
  ALLY_HP_BELOW: "tactics.condition.ally_hp_below",
  ALLY_MP_BELOW: "tactics.condition.ally_mp_below",
  ANY_ALLY_HAS_STATUS: "tactics.condition.any_ally_has_status",
  ALL_OF: "tactics.condition.all_of",
  ALWAYS: "tactics.condition.always",
};

const TARGET_KEYS: Record<TargetType, TranslationKey> = {
  AUTO: "tactics.target.auto",
  SELF: "tactics.target.self",
  ALLY_LOWEST_HP: "tactics.target.ally_lowest_hp",
  ALLY_FIRST_MATCHING_CONDITION: "tactics.target.ally_first_matching_condition",
  ALLY_WITH_STATUS_LOWEST_HP: "tactics.target.ally_with_status_lowest_hp",
  ALLY_POSITION: "tactics.target.ally_position",
};

export const getConditionTypeLabel = (type: ConditionType, t: TFunc): string => t(CONDITION_KEYS[type]);
export const getTargetTypeLabel = (type: TargetType, t: TFunc): string => t(TARGET_KEYS[type]);

const formatPercentValue = (raw: unknown): string => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "?";
  const percent = n * 100;
  if (Number.isInteger(percent)) return String(percent);
  return percent.toFixed(1).replace(/\.0$/, "");
};

const describeConditionByType = (
  type: ConditionType,
  params: Record<string, unknown>,
  t: TFunc
): string => {
  switch (type) {
    case "TURN_EQUALS":
      return t("tactics.condition_sentence.turn_equals", {
        turn: Number.isFinite(Number(params.turn)) ? Number(params.turn) : "?",
      });
    case "BOSS_BATTLE":
      return t("tactics.condition_sentence.boss_battle");
    case "ENEMY_COUNT_AT_LEAST":
      return t("tactics.condition_sentence.enemy_count_at_least", {
        count: Number.isFinite(Number(params.count)) ? Number(params.count) : "?",
      });
    case "SELF_HP_BELOW":
      return t("tactics.condition_sentence.self_hp_below", {
        value: formatPercentValue(params.threshold),
      });
    case "SELF_HP_ABOVE":
      return t("tactics.condition_sentence.self_hp_above", {
        value: formatPercentValue(params.threshold),
      });
    case "ALLY_HP_BELOW":
      return t("tactics.condition_sentence.ally_hp_below", {
        value: formatPercentValue(params.threshold),
      });
    case "ALLY_MP_BELOW":
      return t("tactics.condition_sentence.ally_mp_below", {
        value: formatPercentValue(params.threshold),
      });
    case "ANY_ALLY_HAS_STATUS":
      return t("tactics.condition_sentence.any_ally_has_status", {
        status: String(params.status ?? "?"),
      });
    case "ALL_OF": {
      const raw = Array.isArray(params.conditions)
        ? (params.conditions as Array<{ type?: unknown; params?: Record<string, unknown> }>)
        : [];
      if (raw.length === 0) return t("tactics.condition_sentence.all_of_empty");
      return raw
        .map((entry) =>
          describeConditionByType(
            String(entry.type ?? "ALWAYS") as ConditionType,
            entry.params ?? {},
            t
          )
        )
        .join(` ${t("tactics.param.and")} `);
    }
    case "ALWAYS":
      return t("tactics.condition_sentence.always");
    default:
      return getConditionTypeLabel(type, t);
  }
};

export const describeConditionSentence = (rule: TacticsRuleRecord, t: TFunc): string =>
  describeConditionByType(rule.conditionType, parseParams(rule.conditionParams), t);

export const summarizeConditionParams = (rule: TacticsRuleRecord, t: TFunc): string => {
  const params = parseParams(rule.conditionParams);
  switch (rule.conditionType) {
    case "TURN_EQUALS":
      return `${t("tactics.param.turn")}=${String(params.turn ?? "?")}`;
    case "BOSS_BATTLE":
      return "";
    case "ENEMY_COUNT_AT_LEAST":
      return `${t("tactics.param.count")}=${String(params.count ?? "?")}`;
    case "SELF_HP_BELOW":
    case "SELF_HP_ABOVE":
    case "ALLY_HP_BELOW":
    case "ALLY_MP_BELOW":
      return `${t("tactics.param.threshold")}=${String(params.threshold ?? "?")}`;
    case "ANY_ALLY_HAS_STATUS":
      return `${t("tactics.param.status")}=${String(params.status ?? "?")}`;
    case "ALL_OF": {
      const raw = Array.isArray(params.conditions)
        ? (params.conditions as Array<{ type?: unknown; params?: Record<string, unknown> }>)
        : [];
      if (raw.length === 0) return `${t("tactics.param.conditions")}=[]`;
      return raw
        .map((entry) => {
          const type = String(entry.type ?? "?") as ConditionType;
          const label =
            type in CONDITION_KEYS ? getConditionTypeLabel(type, t) : String(entry.type ?? "?");
          const entryParams = entry.params ?? {};
          if ("turn" in entryParams) return `${label}(${t("tactics.param.turn")}=${String(entryParams.turn)})`;
          if ("threshold" in entryParams) {
            return `${label}(${t("tactics.param.threshold")}=${String(entryParams.threshold)})`;
          }
          if ("status" in entryParams) {
            return `${label}(${t("tactics.param.status")}=${String(entryParams.status)})`;
          }
          return label;
        })
        .join(` ${t("tactics.param.and")} `);
    }
    case "ALWAYS":
    default:
      return "";
  }
};

export const summarizeTargetParams = (rule: TacticsRuleRecord, t: TFunc): string => {
  const params = parseParams(rule.targetParams);
  switch (rule.targetType) {
    case "ALLY_WITH_STATUS_LOWEST_HP":
      return `${t("tactics.param.status")}=${String(params.status ?? "?")}`;
    case "ALLY_POSITION":
      return `${t("tactics.param.position")}=${String(params.position ?? "?")}`;
    default:
      return "";
  }
};
