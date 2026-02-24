import { Skill } from "./types";

export const SWORDMAN_SKILLS: Skill[] = [
  {
    id: "focus",
    name: "Focus",
    type: "buff",
    target: "SELF",
    mpCost: 5,
    cooldown: 3,
    effects: [{ kind: "NEXT_ATTACK_MULTIPLIER", id: "FOCUS_NEXT_ATTACK", multiplier: 2.5 }],
    tags: ["buff", "damage"],
  },
  {
    id: "sword_dance",
    name: "Sword Dance",
    type: "attack",
    target: "ENEMY",
    mpCost: 8,
    cooldown: 3,
    hitCount: 4,
    hitMultiplier: 0.5,
    tags: ["damage", "multi_hit"],
  },
  {
    id: "rift_slash",
    name: "Rift Slash",
    type: "attack",
    target: "ENEMY",
    mpCost: 6,
    cooldown: 2,
    multiplier: 1.0,
    effects: [
      { kind: "DAMAGE_REDUCTION", id: "RIFT_SLASH_DMG_TAKEN_UP", multiplier: 1.15, duration: 3 },
    ],
    tags: ["damage", "debuff"],
  },
];

export const BERSERKER_SKILLS: Skill[] = [
  {
    id: "sweep",
    name: "Sweep",
    type: "attack",
    target: "ENEMY",
    area: "ENEMY_ROW",
    mpCost: 6,
    cooldown: 2,
    multiplier: 1.0,
    tags: ["damage", "aoe"],
  },
  {
    id: "crushing_swing",
    name: "Crushing Swing",
    type: "attack",
    target: "ENEMY",
    mpCost: 8,
    cooldown: 3,
    multiplier: 2.0,
    tags: ["damage", "burst"],
  },
  {
    id: "pump_up",
    name: "Pump Up",
    type: "buff",
    target: "SELF",
    mpCost: 5,
    cooldown: 4,
    effects: [
      {
        kind: "OUTGOING_DAMAGE_MULTIPLIER",
        id: "PUMP_UP_DAMAGE",
        multiplier: 1.2,
        duration: 3,
      },
    ],
    tags: ["buff", "damage"],
  },
];
