import { ARCANE_SKILLS } from "./arcane";
import { BLADE_SKILLS } from "./blade";
import { CLERIC_SKILLS } from "./cleric";
import { GUARDIAN_SKILLS } from "./guardian";
import { JobDefinition } from "./types";

export const CLASS_DEFINITIONS: JobDefinition[] = [
  { id: "GUARDIAN", name: "Guardian", role: "TANK", skills: GUARDIAN_SKILLS },
  { id: "SWORDMAN", name: "Swordman", role: "DPS", skills: BLADE_SKILLS },
  { id: "BERSERKER", name: "Berserker", role: "DPS", skills: BLADE_SKILLS },
  { id: "CLERIC", name: "Cleric", role: "HEALER", skills: CLERIC_SKILLS },
  { id: "WITCH", name: "Witch", role: "SUPPORT", skills: ARCANE_SKILLS },
  { id: "THIEF", name: "Thief", role: "DPS", skills: BLADE_SKILLS },
];
