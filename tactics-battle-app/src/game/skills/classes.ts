import { ARCANE_SKILLS } from "./arcane";
import { BERSERKER_SKILLS, SWORDMAN_SKILLS } from "./blade";
import { CLERIC_SKILLS } from "./cleric";
import { GUARDIAN_SKILLS } from "./guardian";
import { THIEF_SKILLS } from "./thief";
import { ClassDefinition } from "./types";

export const CLASS_DEFINITIONS: ClassDefinition[] = [
  { id: "GUARDIAN", name: "Guardian", role: "TANK", skills: GUARDIAN_SKILLS },
  { id: "SWORDMAN", name: "Swordman", role: "DPS", skills: SWORDMAN_SKILLS },
  { id: "BERSERKER", name: "Berserker", role: "DPS", skills: BERSERKER_SKILLS },
  { id: "CLERIC", name: "Cleric", role: "HEALER", skills: CLERIC_SKILLS },
  { id: "WITCH", name: "Witch", role: "SUPPORT", skills: ARCANE_SKILLS },
  { id: "THIEF", name: "Thief", role: "DPS", skills: THIEF_SKILLS },
  { id: "PORTER", name: "Porter", role: "SUPPORT", skills: [] },
];
