import type { Skill } from "@/game/skills/types";
import { GUARDIAN_SKILLS } from "@/game/skills/guardian";
import { CLERIC_SKILLS } from "@/game/skills/cleric";
import { SWORDMAN_SKILLS, BERSERKER_SKILLS } from "@/game/skills/blade";
import { ARCANE_SKILLS } from "@/game/skills/arcane";
import { THIEF_SKILLS } from "@/game/skills/thief";
import { generateId } from "@/utils/id";

const buildSkillMap = (skills: Skill[]): Map<string, Skill> => {
  const map = new Map<string, Skill>();
  for (const skill of skills) map.set(skill.id, skill);
  return map;
};

const ALL_SKILLS = [
  ...GUARDIAN_SKILLS,
  ...CLERIC_SKILLS,
  ...SWORDMAN_SKILLS,
  ...BERSERKER_SKILLS,
  ...THIEF_SKILLS,
  ...ARCANE_SKILLS,
];

export const createBattleSessionId = (): string => generateId("battle");

export const createSkillMap = (skills: Skill[]): Map<string, Skill> => buildSkillMap(skills);

export const DEFAULT_SKILLS = ALL_SKILLS;
