import type { TranslationKey } from "@/i18n";
import type { Skill } from "./types";

const SKILL_NAME_KEYS: Partial<Record<string, TranslationKey>> = {
  defend: "skill.name.defend",
  taunt: "skill.name.taunt",
  substitute: "skill.name.substitute",
  focus: "skill.name.focus",
  sword_dance: "skill.name.sword_dance",
  rift_slash: "skill.name.rift_slash",
  sweep: "skill.name.sweep",
  crushing_swing: "skill.name.crushing_swing",
  pump_up: "skill.name.pump_up",
  heal: "skill.name.heal",
  all_heal: "skill.name.all_heal",
  defense_up: "skill.name.defense_up",
  healing_potion: "skill.name.healing_potion",
  antidote_herb: "skill.name.antidote_herb",
  ether: "skill.name.ether",
  lightning: "skill.name.lightning",
  fireball: "skill.name.fireball",
  mana_charge: "skill.name.mana_charge",
};

export const getSkillNameKey = (skillId: string): TranslationKey | null =>
  SKILL_NAME_KEYS[skillId] ?? null;

export const getSkillDisplayName = (
  skill: Skill,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string => {
  const key = getSkillNameKey(skill.id);
  return key ? t(key) : skill.name;
};
