import { Skill } from "./types";

export const ARCANE_SKILLS: Skill[] = [
  {
    id: "weaken",
    name: "Weaken",
    type: "debuff",
    target: "ENEMY",
    mpCost: 6,
    cooldown: 3,
    effects: [{ kind: "DEBUFF", id: "ATK_DOWN", stat: "atk", amount: -4, duration: 3 }],
    tags: ["debuff"],
  },
  {
    id: "armor_break",
    name: "Armor Break",
    type: "debuff",
    target: "ENEMY",
    mpCost: 6,
    cooldown: 3,
    effects: [{ kind: "DEBUFF", id: "DEF_DOWN", stat: "def", amount: -4, duration: 3 }],
    tags: ["debuff"],
  },
  {
    id: "poison",
    name: "Poison",
    type: "status",
    target: "ENEMY",
    mpCost: 5,
    cooldown: 2,
    effects: [{ kind: "STATUS", status: "POISON", duration: 3, potency: 6 }],
    tags: ["dot", "status"],
  },
  {
    id: "mana_charge",
    name: "Mana Charge",
    type: "utility",
    target: "SELF",
    mpCost: 0,
    cooldown: 4,
    effects: [{ kind: "MP_RECOVER", amount: 10 }],
    tags: ["utility"],
  },
];
