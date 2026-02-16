import { Skill } from "./types";

export const CLERIC_SKILLS: Skill[] = [
  {
    id: "heal",
    name: "Heal",
    type: "heal",
    target: "ALLY",
    mpCost: 6,
    cooldown: 1,
    effects: [{ kind: "HEAL", amount: 18 }],
    tags: ["heal"],
  },
  {
    id: "greater_heal",
    name: "Greater Heal",
    type: "heal",
    target: "ALLY",
    mpCost: 10,
    cooldown: 3,
    effects: [{ kind: "HEAL", amount: 35 }],
    tags: ["heal"],
  },
  {
    id: "cleanse",
    name: "Cleanse",
    type: "cleanse",
    target: "ALLY",
    mpCost: 4,
    cooldown: 1,
    effects: [{ kind: "CLEANSE", status: "POISON" }],
    tags: ["cleanse"],
  },
  {
    id: "bless",
    name: "Bless",
    type: "buff",
    target: "ALLY",
    mpCost: 6,
    cooldown: 4,
    effects: [{ kind: "BUFF", id: "ATK_UP", stat: "atk", amount: 3, duration: 3 }],
    tags: ["buff"],
  },
];
