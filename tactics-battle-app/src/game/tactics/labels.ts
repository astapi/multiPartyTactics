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
  SELF_HP_BELOW: "tactics.condition.self_hp_below",
  ALLY_HP_BELOW: "tactics.condition.ally_hp_below",
  ALLY_MP_BELOW: "tactics.condition.ally_mp_below",
  ENEMY_HP_BELOW: "tactics.condition.enemy_hp_below",
  ANY_ALLY_HAS_STATUS: "tactics.condition.any_ally_has_status",
  ALL_OF: "tactics.condition.all_of",
  ALWAYS: "tactics.condition.always",
};

const TARGET_KEYS: Record<TargetType, TranslationKey> = {
  SELF: "tactics.target.self",
  ALLY_LOWEST_HP: "tactics.target.ally_lowest_hp",
  ALLY_WITH_STATUS_LOWEST_HP: "tactics.target.ally_with_status_lowest_hp",
  ALLY_POSITION: "tactics.target.ally_position",
  ENEMY_FIRST: "tactics.target.enemy_first",
  ENEMY_POSITION: "tactics.target.enemy_position",
  ENEMY_LOWEST_HP: "tactics.target.enemy_lowest_hp",
};

export const getConditionTypeLabel = (type: ConditionType, t: TFunc): string => t(CONDITION_KEYS[type]);
export const getTargetTypeLabel = (type: TargetType, t: TFunc): string => t(TARGET_KEYS[type]);

export const summarizeConditionParams = (rule: TacticsRuleRecord, t: TFunc): string => {
  const params = parseParams(rule.conditionParams);
  switch (rule.conditionType) {
    case "TURN_EQUALS":
      return `${t("tactics.param.turn")}=${String(params.turn ?? "?")}`;
    case "SELF_HP_BELOW":
    case "ALLY_HP_BELOW":
    case "ALLY_MP_BELOW":
    case "ENEMY_HP_BELOW":
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
    case "ENEMY_POSITION":
      return `${t("tactics.param.position")}=${String(params.position ?? "?")}`;
    default:
      return "";
  }
};

