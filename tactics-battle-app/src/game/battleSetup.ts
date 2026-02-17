import {
  ARCANE_SKILLS,
  BLADE_SKILLS,
  CLERIC_SKILLS,
  GUARDIAN_SKILLS,
  Skill,
  VENOM_TYRANT,
} from "@/game/skills";
import { generateId } from "@/utils/id";

const buildSkillMap = (skills: Skill[]): Map<string, Skill> => {
  const map = new Map<string, Skill>();
  for (const skill of skills) map.set(skill.id, skill);
  return map;
};

const ALL_SKILLS = [
  ...VENOM_TYRANT.skills,
  ...GUARDIAN_SKILLS,
  ...CLERIC_SKILLS,
  ...BLADE_SKILLS,
  ...ARCANE_SKILLS,
];

export const createBattleSessionId = (): string => generateId("battle");

export const createSkillMap = (skills: Skill[]): Map<string, Skill> => buildSkillMap(skills);

export const DEFAULT_SKILLS = ALL_SKILLS;
