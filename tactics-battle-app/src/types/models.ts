import type { ConstellationId } from "@/constants/constellations";

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
  constellationId: ConstellationId;
  level: number;
  exp: number;
  baseMaxHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpd: number;
  baseMaxMp: number;
  baseMpRegen: number;
  currentHp: number;
  currentMp: number;
};

export type PartyRecord = {
  id: string;
  name: string;
  createdAt: string;
};

export type PartyMemberRecord = CharacterRecord & { slotIndex: number };

export type PartyWithMembers = {
  party: PartyRecord;
  members: PartyMemberRecord[];
};

export type ConditionType =
  | "TURN_EQUALS"
  | "SELF_HP_BELOW"
  | "ALLY_HP_BELOW"
  | "ALLY_MP_BELOW"
  | "ENEMY_HP_BELOW"
  | "ANY_ALLY_HAS_STATUS"
  | "ALL_OF"
  | "ALWAYS";

export type TargetType =
  | "SELF"
  | "ALLY_LOWEST_HP"
  | "ALLY_WITH_STATUS_LOWEST_HP"
  | "ALLY_POSITION"
  | "ENEMY_FIRST"
  | "ENEMY_POSITION"
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

export type DungeonFloorExplorationProgressRecord = {
  dungeonId: string;
  floor: number;
  explorationPercent: number;
  stairsDiscovered: boolean;
  updatedAt: string;
};

export type DungeonPartyUiMode = "IDLE" | "EXPLORE" | "AUTO";

export type DungeonPartyUiStateRecord = {
  partyId: string;
  dungeonId: string;
  selectedFloor: number | null;
  stepCount: number;
  mode: DungeonPartyUiMode;
  autoRunCount: number;
  autoLootCount: number;
  autoElapsedSeconds: number;
  updatedAt: string;
};

/**
 * 戦闘の状態を表す型
 * - IDLE: 戦闘開始前（Store専用、DBには保存されない）
 * - IN_PROGRESS: 戦闘中
 * - WIN: 勝利
 * - LOSE: 敗北
 * - DRAW: 引き分け
 */
export type BattleStatus = "IDLE" | "IN_PROGRESS" | "WIN" | "LOSE" | "DRAW";

/** DB保存用の戦闘ステータス（IDLEを除く） */
export type BattleSessionStatus = Exclude<BattleStatus, "IDLE">;

export type BattleSessionRecord = {
  id: string;
  dungeonId: string;
  floor: number;
  turn: number;
  status: BattleSessionStatus;
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
