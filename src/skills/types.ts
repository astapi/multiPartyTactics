import { Action, Effect, StatusEffect, StatusType, Unit } from "../battle";

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
