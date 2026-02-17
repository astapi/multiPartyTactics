export type ClassId =
  | "GUARDIAN"
  | "SWORDMAN"
  | "BERSERKER"
  | "CLERIC"
  | "WITCH"
  | "THIEF";

export type CharacterRecord = {
  id: string;
  slotIndex: number | null;
  name: string;
  classId: ClassId;
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
  dungeonId: string;
  lastEnteredFloor: number;
  maxClearedFloor: number;
  clearCount: number;
  updatedAt: string;
};

export type BattleSessionRecord = {
  id: string;
  dungeonId: string;
  floor: number;
  turn: number;
  status: "IN_PROGRESS" | "WIN" | "LOSE";
  explorationSeed: number | null;
  startedAt: string;
  endedAt: string | null;
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
