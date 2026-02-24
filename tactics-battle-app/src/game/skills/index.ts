export * from "./types";
export * from "./execute";
export * from "./guardian";
export * from "./cleric";
export * from "./blade";
export * from "./arcane";
export * from "./thief";
export * from "./classes";
export * from "./labels";

import { Skill } from "./types";

export const getSkillById = (skills: Skill[], id: string): Skill | undefined =>
  skills.find((skill) => skill.id === id);
