import { Skill } from "./types";

export const GUARDIAN_SKILLS: Skill[] = [
  {
    id: "guard_stance",
    name: "Guard Stance",
    type: "buff",
    target: "SELF",
    mpCost: 4,
    cooldown: 3,
    effects: [{ kind: "BUFF", id: "DEF_UP", stat: "def", amount: 4, duration: 3 }],
    tags: ["buff", "defense"],
  },
  {
    id: "shield_bash",
    name: "Shield Bash",
    type: "attack",
    target: "ENEMY",
    mpCost: 5,
    cooldown: 4,
    power: 6,
    effects: [{ kind: "STATUS", status: "STUN", duration: 1, chance: 0.3 }],
    tags: ["damage", "control"],
  },
  {
    id: "fortify",
    name: "Fortify",
    type: "buff",
    target: "SELF",
    mpCost: 6,
    cooldown: 5,
    effects: [
      {
        kind: "DAMAGE_REDUCTION",
        id: "DAMAGE_REDUCTION",
        multiplier: 0.7,
        duration: 2,
      },
    ],
    tags: ["buff", "defense"],
  },
];
