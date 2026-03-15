import { Skill } from "./types";

export const ARCANE_SKILLS: Skill[] = [
  {
    id: "lightning",
    name: "Lightning",
    type: "attack",
    target: "ENEMY",
    area: "ALL_ENEMIES",
    mpCost: 8,
    cooldown: 3,
    multiplier: 1.3,
    powerStat: "spi",
    tags: ["damage", "aoe"],
  },
  {
    id: "fireball",
    name: "Fireball",
    type: "attack",
    target: "ENEMY",
    area: "RANDOM_ENEMY",
    mpCost: 8,
    cooldown: 3,
    hitCount: 3,
    hitMultiplier: 1.0,
    powerStat: "spi",
    randomizeTargetPerHit: true,
    tags: ["damage", "multi_hit"],
  },
  {
    id: "mana_charge",
    name: "Mana Charge",
    type: "buff",
    target: "SELF",
    mpCost: 4,
    cooldown: 4,
    effects: [
      {
        kind: "OUTGOING_DAMAGE_MULTIPLIER",
        id: "MANA_CHARGE_DAMAGE",
        multiplier: 1.1,
        duration: 3,
      },
    ],
    tags: ["buff", "damage"],
  },
];
