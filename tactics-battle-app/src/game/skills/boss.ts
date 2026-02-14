import { BossDefinition, Skill } from "./types";

export const VENOM_TYRANT_SKILLS: Skill[] = [
  {
    id: "claw",
    name: "Claw",
    type: "attack",
    target: "ENEMY",
    mpCost: 0,
    cooldown: 0,
    power: 6,
    tags: ["basic"],
  },
  {
    id: "venom_spit",
    name: "Venom Spit",
    type: "status",
    target: "ENEMY",
    mpCost: 0,
    cooldown: 2,
    effects: [{ kind: "STATUS", status: "POISON", duration: 3, potency: 8 }],
    tags: ["poison"],
  },
  {
    id: "crushing_slam",
    name: "Crushing Slam",
    type: "attack",
    target: "ENEMY",
    mpCost: 0,
    cooldown: 3,
    power: 14,
    effects: [{ kind: "DEBUFF", id: "DEF_DOWN", stat: "def", amount: -2, duration: 2 }],
    tags: ["big_hit"],
  },
  {
    id: "enrage",
    name: "Enrage",
    type: "buff",
    target: "SELF",
    mpCost: 0,
    cooldown: 999,
    effects: [{ kind: "ENRAGE", id: "ENRAGED", atkBonus: 4 }],
    tags: ["phase"],
  },
];

export const VENOM_TYRANT: BossDefinition = {
  id: "VENOM_TYRANT",
  name: "Venom Tyrant",
  stats: {
    maxHp: 260,
    atk: 14,
    def: 6,
    spd: 9,
    maxMp: 999,
    mpRegen: 0,
  },
  skills: VENOM_TYRANT_SKILLS,
};
