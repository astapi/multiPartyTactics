import { Action, Effect, StatusEffect, StatusType, Unit } from "../battle";
import { ClassId } from "@/types/models";

export type SkillTarget = "SELF" | "ALLY" | "ENEMY";

export type SkillType =
  | "attack"
  | "heal"
  | "buff"
  | "debuff"
  | "status"
  | "cleanse"
  | "utility"
  | "item";

export type SkillArea =
  | "SINGLE"
  | "ALLY_ALL"
  | "ALL_ENEMIES"
  | "ENEMY_ROW"
  | "RANDOM_ENEMY";

export type SkillItemCost = {
  itemId: string;
  amount: number;
};

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
      kind: "OUTGOING_DAMAGE_MULTIPLIER";
      id: string;
      multiplier: number;
      duration: number;
    }
  | {
      kind: "NEXT_ATTACK_MULTIPLIER";
      id: string;
      multiplier: number;
    }
  | {
      kind: "TAUNT";
      id: string;
      duration: number;
    }
  | {
      kind: "COVER_ALL";
      id: string;
      duration: number;
    }
  | {
      kind: "HEAL";
      amount: number;
    }
  | {
      kind: "HEAL_MULTIPLIER";
      multiplier: number;
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
  area?: SkillArea;
  mpCost: number;
  cooldown: number;
  multiplier?: number;
  powerStat?: "atk" | "spi";
  hitCount?: number;
  hitMultiplier?: number;
  randomizeTargetPerHit?: boolean;
  itemCosts?: SkillItemCost[];
  effects?: SkillEffect[];
  tags: string[];
};

export type SkillExecutionContext = {
  itemStock?: Record<string, number>;
  allies?: Unit[];
  opponents?: Unit[];
};

export type ClassDefinition = {
  id: ClassId;
  name: string;
  role: "TANK" | "HEALER" | "DPS" | "SUPPORT";
  skills: Skill[];
};

export type SkillUseResult = {
  action: Action;
  damage: number;
  healing: number;
  appliedStatuses: StatusEffect[];
  cleansedStatuses: StatusType[];
  appliedEffects: Effect[];
  hitCount: number;
  consumedItems: SkillItemCost[];
  resolvedTargetIds: string[];
};
