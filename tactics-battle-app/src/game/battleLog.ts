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

export const formatBattleLogMessage = (
  log: BattleLogRecord,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string => {
  switch (log.logMessage as TranslationKey | string) {
    case "battle.log.poison_tick":
      return t("battle.log.poison_tick", {
        actorName: log.actorName,
        damage: log.damage,
      });
    case "battle.log.skip_stun":
      return t("battle.log.skip_stun", {
        actorName: log.actorName,
      });
    case "battle.log.basic_attack":
      return t("battle.log.basic_attack", {
        actorName: log.actorName,
        targetName: log.targetName ?? "-",
      });
    case "battle.log.skill_use":
      return t("battle.log.skill_use", {
        actorName: log.actorName,
        skillName: getActionLabel(log.actionType, t),
      });
    case "battle.log.skill_use_target":
      return t("battle.log.skill_use_target", {
        actorName: log.actorName,
        skillName: getActionLabel(log.actionType, t),
        targetName: log.targetName ?? "-",
      });
    default:
      return log.logMessage;
  }
};
