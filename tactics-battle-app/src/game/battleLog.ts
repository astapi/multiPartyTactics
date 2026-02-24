import type { TranslationKey } from "@/i18n";
import { getSkillNameKey } from "@/game/skills";
import type { BattleLogRecord } from "@/types/models";

const ACTION_LABEL_KEYS: Partial<Record<string, TranslationKey>> = {
  basic_attack: "skill.name.basic_attack",
};

const getActionLabel = (
  actionType: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string => {
  const skillKey = getSkillNameKey(actionType);
  if (skillKey) return t(skillKey);
  const actionKey = ACTION_LABEL_KEYS[actionType];
  if (actionKey) return t(actionKey);
  return actionType;
};

const appendCombatResult = (
  base: string,
  log: BattleLogRecord,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string => {
  const chunks: string[] = [];
  if (log.damage > 0) {
    chunks.push(t("battle.log.meta.damage", { damage: log.damage }));
  }
  if (log.healing > 0) {
    chunks.push(t("battle.log.meta.healing", { healing: log.healing }));
  }
  if (chunks.length === 0) return base;
  return `${base} ${t("battle.log.meta.wrap", { detail: chunks.join(" / ") })}`;
};

export const formatBattleLogMessage = (
  log: BattleLogRecord,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string => {
  let message: string;
  switch (log.logMessage as TranslationKey | string) {
    case "battle.log.poison_tick":
      message = t("battle.log.poison_tick", {
        actorName: log.actorName,
        damage: log.damage,
      });
      break;
    case "battle.log.skip_stun":
      message = t("battle.log.skip_stun", {
        actorName: log.actorName,
      });
      break;
    case "battle.log.basic_attack":
      message = t("battle.log.basic_attack", {
        actorName: log.actorName,
        targetName: log.targetName ?? "-",
      });
      break;
    case "battle.log.skill_use":
      message = t("battle.log.skill_use", {
        actorName: log.actorName,
        skillName: getActionLabel(log.actionType, t),
      });
      break;
    case "battle.log.skill_use_target":
      message = t("battle.log.skill_use_target", {
        actorName: log.actorName,
        skillName: getActionLabel(log.actionType, t),
        targetName: log.targetName ?? "-",
      });
      break;
    default:
      message = log.logMessage;
      break;
  }
  return appendCombatResult(message, log, t);
};
