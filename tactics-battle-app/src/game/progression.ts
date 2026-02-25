import type { CharacterRecord, ClassId } from "@/types/models";
import { ConstellationId, getConstellationGrowthBonus } from "@/constants/constellations";

export const MAX_CHARACTER_LEVEL = 999;

export type StatBlock = {
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  maxMp: number;
  mpRegen: number;
};

export type GrowthRate = StatBlock;

export type CharacterProgressionResult = {
  character: CharacterRecord;
  gainedExp: number;
  leveledUpBy: number;
  previousLevel: number;
  newLevel: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const safeInt = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value);
};

const getRequiredExpForLevelUp = (level: number): number => {
  const lv = clamp(safeInt(level), 1, MAX_CHARACTER_LEVEL);
  return Math.floor(20 + 7 * lv + 0.02 * lv * lv);
};

const GROWTH_RATE_BY_CLASS: Record<ClassId, GrowthRate> = {
  GUARDIAN: { maxHp: 6.0, atk: 0.55, def: 1.0, spd: 0.25, maxMp: 0.6, mpRegen: 0.005 },
  SWORDMAN: { maxHp: 5.0, atk: 0.9, def: 0.6, spd: 0.5, maxMp: 0.6, mpRegen: 0.005 },
  BERSERKER: { maxHp: 5.5, atk: 1.1, def: 0.45, spd: 0.45, maxMp: 0.4, mpRegen: 0.004 },
  CLERIC: { maxHp: 4.0, atk: 0.35, def: 0.45, spd: 0.5, maxMp: 1.2, mpRegen: 0.01 },
  WITCH: { maxHp: 3.5, atk: 0.45, def: 0.35, spd: 0.6, maxMp: 1.4, mpRegen: 0.012 },
  THIEF: { maxHp: 4.5, atk: 0.8, def: 0.35, spd: 0.95, maxMp: 0.7, mpRegen: 0.006 },
};

const BASE_LEVEL_STATS_BY_CLASS: Record<ClassId, StatBlock> = {
  GUARDIAN: { maxHp: 120, atk: 8, def: 10, spd: 8, maxMp: 20, mpRegen: 2 },
  SWORDMAN: { maxHp: 100, atk: 11, def: 8, spd: 10, maxMp: 22, mpRegen: 2 },
  BERSERKER: { maxHp: 110, atk: 14, def: 6, spd: 9, maxMp: 18, mpRegen: 2 },
  CLERIC: { maxHp: 80, atk: 5, def: 6, spd: 10, maxMp: 35, mpRegen: 2 },
  WITCH: { maxHp: 75, atk: 6, def: 5, spd: 11, maxMp: 30, mpRegen: 2 },
  THIEF: { maxHp: 90, atk: 12, def: 5, spd: 12, maxMp: 25, mpRegen: 2 },
};

const TOTAL_EXP_FOR_LEVEL: number[] = (() => {
  const table = new Array<number>(MAX_CHARACTER_LEVEL + 1).fill(0);
  table[1] = 0;
  for (let level = 2; level <= MAX_CHARACTER_LEVEL; level += 1) {
    table[level] = table[level - 1] + getRequiredExpForLevelUp(level - 1);
  }
  return table;
})();

export const getTotalExpForLevel = (level: number): number => {
  const lv = clamp(safeInt(level), 1, MAX_CHARACTER_LEVEL);
  return TOTAL_EXP_FOR_LEVEL[lv];
};

export const getLevelFromTotalExp = (exp: number): number => {
  const normalizedExp = clamp(safeInt(exp), 0, getTotalExpForLevel(MAX_CHARACTER_LEVEL));
  let low = 1;
  let high = MAX_CHARACTER_LEVEL;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (TOTAL_EXP_FOR_LEVEL[mid] <= normalizedExp) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
};

export const getExpIntoCurrentLevel = (exp: number, level: number): number => {
  const lv = clamp(safeInt(level), 1, MAX_CHARACTER_LEVEL);
  const normalizedExp = clamp(safeInt(exp), 0, getTotalExpForLevel(MAX_CHARACTER_LEVEL));
  if (lv >= MAX_CHARACTER_LEVEL) return 0;
  return Math.max(0, normalizedExp - getTotalExpForLevel(lv));
};

export const getExpToNextLevel = (exp: number, level: number): number => {
  const lv = clamp(safeInt(level), 1, MAX_CHARACTER_LEVEL);
  if (lv >= MAX_CHARACTER_LEVEL) return 0;
  const normalizedExp = clamp(safeInt(exp), 0, getTotalExpForLevel(MAX_CHARACTER_LEVEL));
  const nextLevelTotal = getTotalExpForLevel(lv + 1);
  return Math.max(0, nextLevelTotal - normalizedExp);
};

export const getExpRequiredForNextLevel = (level: number): number => {
  const lv = clamp(safeInt(level), 1, MAX_CHARACTER_LEVEL);
  if (lv >= MAX_CHARACTER_LEVEL) return 0;
  return getRequiredExpForLevelUp(lv);
};

export const calculateBattleExp = ({
  floor,
  enemyCount,
}: {
  floor: number;
  enemyCount: number;
}): number => {
  const safeFloor = Math.max(1, safeInt(floor));
  const safeEnemyCount = clamp(safeInt(enemyCount), 1, 3);
  const base = Math.floor(4 + safeFloor * 0.35);
  return Math.max(1, base + (safeEnemyCount - 1) * 4);
};

export const getBaseStatsForClassLevel = (
  classId: ClassId,
  level: number,
  constellationId?: ConstellationId
): StatBlock => {
  const lv = clamp(safeInt(level), 1, MAX_CHARACTER_LEVEL);
  const levelOffset = lv - 1;
  const base = BASE_LEVEL_STATS_BY_CLASS[classId];
  const growth = GROWTH_RATE_BY_CLASS[classId];
  const constellationBonus = getConstellationGrowthBonus(constellationId);

  return {
    maxHp: base.maxHp + Math.floor(levelOffset * (growth.maxHp + constellationBonus.maxHp)),
    atk: base.atk + Math.floor(levelOffset * (growth.atk + constellationBonus.atk)),
    def: base.def + Math.floor(levelOffset * (growth.def + constellationBonus.def)),
    spd: base.spd + Math.floor(levelOffset * (growth.spd + constellationBonus.spd)),
    maxMp: base.maxMp + Math.floor(levelOffset * (growth.maxMp + constellationBonus.maxMp)),
    mpRegen: base.mpRegen + Math.floor(levelOffset * (growth.mpRegen + constellationBonus.mpRegen)),
  };
};

export const applyExperienceToCharacter = (
  record: CharacterRecord,
  gainedExp: number
): CharacterProgressionResult => {
  const previousLevel = clamp(safeInt(record.level), 1, MAX_CHARACTER_LEVEL);
  const normalizedCurrentExp = clamp(
    safeInt(record.exp),
    0,
    getTotalExpForLevel(MAX_CHARACTER_LEVEL)
  );
  const expGain = Math.max(0, safeInt(gainedExp));
  const nextExp = clamp(
    normalizedCurrentExp + expGain,
    0,
    getTotalExpForLevel(MAX_CHARACTER_LEVEL)
  );
  const newLevel = getLevelFromTotalExp(nextExp);
  const nextStats = getBaseStatsForClassLevel(record.classId, newLevel, record.constellationId);

  const nextCharacter: CharacterRecord = {
    ...record,
    level: newLevel,
    exp: nextExp,
    baseMaxHp: nextStats.maxHp,
    baseAtk: nextStats.atk,
    baseDef: nextStats.def,
    baseSpd: nextStats.spd,
    baseMaxMp: nextStats.maxMp,
    baseMpRegen: nextStats.mpRegen,
    currentHp: clamp(safeInt(record.currentHp), 0, nextStats.maxHp),
    currentMp: clamp(safeInt(record.currentMp), 0, nextStats.maxMp),
  };

  return {
    character: nextCharacter,
    gainedExp: nextCharacter.exp - normalizedCurrentExp,
    leveledUpBy: Math.max(0, newLevel - previousLevel),
    previousLevel,
    newLevel,
  };
};
