import { Skill } from "./types";

export const CLERIC_SKILLS: Skill[] = [
  {
    id: "heal",
    name: "Heal",
    type: "heal",
    target: "ALLY",
    mpCost: 6,
    cooldown: 1,
    powerStat: "spi",
    effects: [{ kind: "HEAL_MULTIPLIER", multiplier: 1.5 }],
    tags: ["heal"],
  },
  {
    id: "all_heal",
    name: "All Heal",
    type: "heal",
    target: "ALLY",
    area: "ALLY_ALL",
    mpCost: 10,
    cooldown: 3,
    powerStat: "spi",
    effects: [{ kind: "HEAL_MULTIPLIER", multiplier: 1.0 }],
    tags: ["heal", "aoe"],
  },
  {
    id: "defense_up",
    name: "Defense Up",
    type: "buff",
    target: "ALLY",
    mpCost: 6,
    cooldown: 4,
    effects: [{ kind: "DAMAGE_REDUCTION", id: "DEFENSE_UP", multiplier: 0.8, duration: 3 }],
    tags: ["buff", "defense"],
  },
];
