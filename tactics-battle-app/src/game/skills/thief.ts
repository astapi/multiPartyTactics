import { Skill } from "./types";

export const THIEF_SKILLS: Skill[] = [
  {
    id: "healing_potion",
    name: "Healing Potion",
    type: "item",
    target: "ALLY",
    mpCost: 0,
    cooldown: 0,
    itemCosts: [{ itemId: "healing_potion", amount: 1 }],
    effects: [{ kind: "HEAL", amount: 25 }],
    tags: ["item", "heal"],
  },
  {
    id: "antidote_herb",
    name: "Antidote Herb",
    type: "item",
    target: "ALLY",
    mpCost: 0,
    cooldown: 0,
    itemCosts: [{ itemId: "antidote_herb", amount: 1 }],
    effects: [{ kind: "CLEANSE", status: "POISON" }],
    tags: ["item", "cleanse"],
  },
  {
    id: "ether",
    name: "Ether",
    type: "item",
    target: "ALLY",
    mpCost: 0,
    cooldown: 0,
    itemCosts: [{ itemId: "ether", amount: 1 }],
    effects: [{ kind: "MP_RECOVER", amount: 10 }],
    tags: ["item", "utility"],
  },
];
