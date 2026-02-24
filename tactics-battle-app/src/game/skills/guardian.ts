import { Skill } from "./types";

export const GUARDIAN_SKILLS: Skill[] = [
  {
    id: "defend",
    name: "Defend",
    type: "buff",
    target: "SELF",
    mpCost: 4,
    cooldown: 2,
    effects: [
      { kind: "DAMAGE_REDUCTION", id: "GUARD_DEFEND", multiplier: 0.5, duration: 1 },
    ],
    tags: ["buff", "defense"],
  },
  {
    id: "taunt",
    name: "Taunt",
    type: "utility",
    target: "SELF",
    mpCost: 4,
    cooldown: 3,
    effects: [{ kind: "TAUNT", id: "TAUNT", duration: 1 }],
    tags: ["utility", "control", "tank"],
  },
  {
    id: "substitute",
    name: "Substitute",
    type: "buff",
    target: "SELF",
    mpCost: 6,
    cooldown: 4,
    effects: [{ kind: "COVER_ALL", id: "COVER_ALL", duration: 1 }],
    tags: ["buff", "defense", "cover"],
  },
];
