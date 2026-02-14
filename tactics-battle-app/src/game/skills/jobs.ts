import { ARCANE_SKILLS } from "./arcane";
import { BLADE_SKILLS } from "./blade";
import { CLERIC_SKILLS } from "./cleric";
import { GUARDIAN_SKILLS } from "./guardian";
import { JobDefinition } from "./types";

export const JOB_DEFINITIONS: JobDefinition[] = [
  { id: "GUARDIAN", name: "Guardian", role: "TANK", skills: GUARDIAN_SKILLS },
  { id: "CLERIC", name: "Cleric", role: "HEALER", skills: CLERIC_SKILLS },
  { id: "BLADE", name: "Blade", role: "DPS", skills: BLADE_SKILLS },
  { id: "ARCANE", name: "Arcane", role: "SUPPORT", skills: ARCANE_SKILLS },
];
