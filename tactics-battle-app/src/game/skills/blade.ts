import { Skill } from "./types";

export const BLADE_SKILLS: Skill[] = [
  {
    id: "berserk",
    name: "Berserk",
    type: "buff",
    target: "SELF",
    mpCost: 6,
    cooldown: 5,
    effects: [
      { kind: "BUFF", id: "ATK_UP", stat: "atk", amount: 6, duration: 3 },
      { kind: "DEBUFF", id: "DEF_DOWN", stat: "def", amount: -2, duration: 3 },
    ],
    tags: ["buff", "damage"],
  },
  {
    id: "power_strike",
    name: "Power Strike",
    type: "attack",
    target: "ENEMY",
    mpCost: 5,
    cooldown: 1,
    multiplier: 1.4,
    tags: ["damage"],
  },
  {
    id: "execute",
    name: "Execute",
    type: "attack",
    target: "ENEMY",
    mpCost: 8,
    cooldown: 4,
    multiplier: 2.0,
    tags: ["damage", "finisher"],
  },
];
