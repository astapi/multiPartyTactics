export type JobId = "GUARDIAN" | "CLERIC" | "BLADE" | "ARCANE";

export type CharacterRecord = {
  id: string;
  slotIndex: number;
  name: string;
  jobId: JobId;
  level: number;
  baseMaxHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpd: number;
  baseMaxMp: number;
  baseMpRegen: number;
  currentHp: number;
  currentMp: number;
};

export type ConditionType =
  | "TURN_EQUALS"
  | "SELF_HP_BELOW"
  | "ALLY_HP_BELOW"
  | "ENEMY_HP_BELOW"
  | "ANY_ALLY_HAS_STATUS"
  | "ALWAYS";

export type TargetType =
  | "SELF"
  | "ALLY_LOWEST_HP"
  | "ALLY_WITH_STATUS_LOWEST_HP"
  | "ENEMY_FIRST"
  | "ENEMY_LOWEST_HP";

export type TacticsRuleRecord = {
  id: string;
  characterId: string;
  priority: number;
  skillId: string;
  conditionType: ConditionType;
  conditionParams: string | null;
  targetType: TargetType;
  targetParams: string | null;
};

export type DungeonProgressRecord = {
  id: string;
  dungeonId: string;
  currentFloor: number;
  isCleared: number;
};

export type BattleSessionRecord = {
  id: string;
  dungeonProgressId: string | null;
  turn: number;
  status: "IN_PROGRESS" | "WIN" | "LOSE";
};

export type BattleLogRecord = {
  id?: number;
  battleSessionId: string;
  turn: number;
  actorName: string;
  actionType: string;
  targetName: string | null;
  damage: number;
  healing: number;
  logMessage: string;
};
