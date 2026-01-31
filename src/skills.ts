import {
  Action,
  Effect,
  StatusEffect,
  StatusType,
  Unit,
  applyDamage,
  applyEffect,
  applyHealing,
  applyStatus,
  calculatePhysicalDamage,
} from "./battle";

export type SkillTarget = "SELF" | "ALLY" | "ENEMY";

export type SkillType =
  | "attack"
  | "heal"
  | "buff"
  | "debuff"
  | "status"
  | "cleanse"
  | "utility";

export type SkillEffect =
  | {
      kind: "BUFF";
      id: string;
      stat: "atk" | "def";
      amount: number;
      duration: number;
    }
  | {
      kind: "DEBUFF";
      id: string;
      stat: "atk" | "def";
      amount: number;
      duration: number;
    }
  | {
      kind: "STATUS";
      status: StatusType;
      duration: number;
      potency?: number;
      chance?: number;
    }
  | {
      kind: "DAMAGE_REDUCTION";
      id: string;
      multiplier: number;
      duration: number;
    }
  | {
      kind: "HEAL";
      amount: number;
    }
  | {
      kind: "CLEANSE";
      status: StatusType;
    }
  | {
      kind: "MP_RECOVER";
      amount: number;
    }
  | {
      kind: "ENRAGE";
      id: string;
      atkBonus: number;
    };

export type ConditionalPower = {
  kind: "TARGET_HP_BELOW";
  threshold: number;
  bonus: number;
};

export type Skill = {
  id: string;
  name: string;
  type: SkillType;
  target: SkillTarget;
  mpCost: number;
  cooldown: number;
  power?: number;
  conditionalPower?: ConditionalPower;
  effects?: SkillEffect[];
  tags: string[];
};

export type JobId = "GUARDIAN" | "CLERIC" | "BLADE" | "ARCANE";

export type JobDefinition = {
  id: JobId;
  name: string;
  role: "TANK" | "HEALER" | "DPS" | "SUPPORT";
  skills: Skill[];
};

export type BossDefinition = {
  id: string;
  name: string;
  stats: Unit["stats"];
  skills: Skill[];
};

export type SkillUseResult = {
  action: Action;
  damage: number;
  healing: number;
  appliedStatuses: StatusEffect[];
  cleansedStatuses: StatusType[];
  appliedEffects: Effect[];
};

export const getHpPercent = (unit: Unit): number =>
  unit.stats.maxHp === 0 ? 0 : unit.hp / unit.stats.maxHp;

export const hasEffect = (unit: Unit, id: string): boolean =>
  unit.effects.some((effect) => effect.id === id);

export const isSkillUsable = (actor: Unit, skill: Skill): boolean => {
  if (actor.mp < skill.mpCost) {
    return false;
  }
  const remaining = actor.cooldowns[skill.id] ?? 0;
  return remaining <= 0;
};

export const applySkillCost = (actor: Unit, skill: Skill): void => {
  actor.mp = Math.max(0, actor.mp - skill.mpCost);
  if (skill.cooldown > 0) {
    actor.cooldowns[skill.id] = skill.cooldown;
  }
};

export const removeStatus = (unit: Unit, status: StatusType): boolean => {
  const index = unit.statusEffects.findIndex((effect) => effect.type === status);
  if (index < 0) {
    return false;
  }
  unit.statusEffects.splice(index, 1);
  return true;
};

export const executeSkill = (
  actor: Unit,
  target: Unit,
  skill: Skill,
  rng: () => number = Math.random
): SkillUseResult => {
  if (!isSkillUsable(actor, skill)) {
    throw new Error(`Skill not usable: ${skill.name}`);
  }

  applySkillCost(actor, skill);

  let damage = 0;
  let healing = 0;
  const appliedStatuses: StatusEffect[] = [];
  const cleansedStatuses: StatusType[] = [];
  const appliedEffects: Effect[] = [];

  if (skill.type === "attack") {
    const bonusPower =
      skill.conditionalPower &&
      skill.conditionalPower.kind === "TARGET_HP_BELOW" &&
      getHpPercent(target) < skill.conditionalPower.threshold
        ? skill.conditionalPower.bonus
        : 0;
    const power = (skill.power ?? 0) + bonusPower;
    const dealt = applyDamage(target, calculatePhysicalDamage(actor, target, power));
    damage += dealt;
  }

  for (const effect of skill.effects ?? []) {
    if (effect.kind === "BUFF") {
      const entry: Effect = {
        kind: "STAT",
        id: effect.id,
        stat: effect.stat,
        amount: effect.amount,
        remainingTurns: effect.duration,
        source: skill.id,
      };
      applyEffect(target, entry);
      appliedEffects.push(entry);
      continue;
    }

    if (effect.kind === "DEBUFF") {
      const entry: Effect = {
        kind: "STAT",
        id: effect.id,
        stat: effect.stat,
        amount: effect.amount,
        remainingTurns: effect.duration,
        source: skill.id,
      };
      applyEffect(target, entry);
      appliedEffects.push(entry);
      continue;
    }

    if (effect.kind === "DAMAGE_REDUCTION") {
      const entry: Effect = {
        kind: "DAMAGE_REDUCTION",
        id: effect.id,
        multiplier: effect.multiplier,
        remainingTurns: effect.duration,
        source: skill.id,
      };
      applyEffect(target, entry);
      appliedEffects.push(entry);
      continue;
    }

    if (effect.kind === "ENRAGE") {
      const entry: Effect = {
        kind: "STAT",
        id: effect.id,
        stat: "atk",
        amount: effect.atkBonus,
        remainingTurns: null,
        source: skill.id,
      };
      applyEffect(target, entry);
      appliedEffects.push(entry);
      continue;
    }

    if (effect.kind === "STATUS") {
      const chance = effect.chance ?? 1;
      if (rng() <= chance) {
        const status: StatusEffect = {
          type: effect.status,
          remainingTurns: effect.duration,
          potency: effect.potency,
        };
        applyStatus(target, status);
        appliedStatuses.push(status);
      }
      continue;
    }

    if (effect.kind === "HEAL") {
      healing += applyHealing(target, effect.amount);
      continue;
    }

    if (effect.kind === "CLEANSE") {
      if (removeStatus(target, effect.status)) {
        cleansedStatuses.push(effect.status);
      }
      continue;
    }

    if (effect.kind === "MP_RECOVER") {
      target.mp = Math.min(target.stats.maxMp, target.mp + effect.amount);
      continue;
    }
  }

  const action: Action =
    skill.type === "attack"
      ? { kind: "ATTACK", power: skill.power ?? 0, target }
      : { kind: "WAIT" };

  return { action, damage, healing, appliedStatuses, cleansedStatuses, appliedEffects };
};

export const GUARDIAN_SKILLS: Skill[] = [
  {
    id: "guard_stance",
    name: "Guard Stance",
    type: "buff",
    target: "SELF",
    mpCost: 4,
    cooldown: 3,
    effects: [
      { kind: "BUFF", id: "DEF_UP", stat: "def", amount: 4, duration: 3 },
    ],
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
    effects: [
      {
        kind: "STATUS",
        status: "STUN",
        duration: 1,
        chance: 0.3,
      },
    ],
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
    power: 10,
    tags: ["damage"],
  },
  {
    id: "execute",
    name: "Execute",
    type: "attack",
    target: "ENEMY",
    mpCost: 8,
    cooldown: 4,
    power: 14,
    conditionalPower: {
      kind: "TARGET_HP_BELOW",
      threshold: 0.3,
      bonus: 6,
    },
    tags: ["damage", "finisher"],
  },
];

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
    effects: [
      {
        kind: "STATUS",
        status: "POISON",
        duration: 3,
        potency: 6,
      },
    ],
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

export const JOB_DEFINITIONS: JobDefinition[] = [
  { id: "GUARDIAN", name: "Guardian", role: "TANK", skills: GUARDIAN_SKILLS },
  { id: "CLERIC", name: "Cleric", role: "HEALER", skills: CLERIC_SKILLS },
  { id: "BLADE", name: "Blade", role: "DPS", skills: BLADE_SKILLS },
  { id: "ARCANE", name: "Arcane", role: "SUPPORT", skills: ARCANE_SKILLS },
];

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
    effects: [
      { kind: "STATUS", status: "POISON", duration: 3, potency: 8 },
    ],
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
    effects: [
      { kind: "DEBUFF", id: "DEF_DOWN", stat: "def", amount: -2, duration: 2 },
    ],
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

export const getSkillById = (skills: Skill[], id: string): Skill | undefined =>
  skills.find((skill) => skill.id === id);
