import { describe, expect, it } from "vitest";
import {
  MAX_CHARACTER_LEVEL,
  applyExperienceToCharacter,
  calculateBattleExp,
  getBaseStatsForClassLevel,
  getExpIntoCurrentLevel,
  getExpRequiredForNextLevel,
  getExpToNextLevel,
  getLevelFromTotalExp,
  getTotalExpForLevel,
} from "@/game/progression";
import type { CharacterRecord } from "@/types/models";

const makeCharacter = (overrides: Partial<CharacterRecord> = {}): CharacterRecord => ({
  id: "char-1",
  slotIndex: 0,
  name: "Test",
  classId: "SWORDMAN",
  level: 1,
  exp: 0,
  baseMaxHp: 100,
  baseAtk: 11,
  baseDef: 8,
  baseSpd: 10,
  baseMaxMp: 22,
  baseMpRegen: 2,
  currentHp: 100,
  currentMp: 22,
  ...overrides,
});

describe("game/progression", () => {
  it("builds a monotonically increasing EXP table", () => {
    for (let level = 1; level < 50; level += 1) {
      expect(getTotalExpForLevel(level + 1)).toBeGreaterThan(getTotalExpForLevel(level));
      const need = getTotalExpForLevel(level + 1) - getTotalExpForLevel(level);
      const nextNeed = getTotalExpForLevel(level + 2) - getTotalExpForLevel(level + 1);
      expect(nextNeed).toBeGreaterThanOrEqual(need);
    }
  });

  it("resolves level from total EXP at boundaries", () => {
    expect(getLevelFromTotalExp(0)).toBe(1);
    expect(getLevelFromTotalExp(getTotalExpForLevel(2) - 1)).toBe(1);
    expect(getLevelFromTotalExp(getTotalExpForLevel(2))).toBe(2);
    expect(getLevelFromTotalExp(getTotalExpForLevel(10))).toBe(10);
  });

  it("clamps level at maximum", () => {
    const capExp = getTotalExpForLevel(MAX_CHARACTER_LEVEL);
    expect(getLevelFromTotalExp(capExp)).toBe(MAX_CHARACTER_LEVEL);
    expect(getLevelFromTotalExp(capExp + 99999999)).toBe(MAX_CHARACTER_LEVEL);
  });

  it("calculates battle EXP by floor and enemy count", () => {
    expect(calculateBattleExp({ floor: 1, enemyCount: 1 })).toBeGreaterThan(0);
    expect(calculateBattleExp({ floor: 10, enemyCount: 1 })).toBeGreaterThan(
      calculateBattleExp({ floor: 1, enemyCount: 1 })
    );
    expect(calculateBattleExp({ floor: 50, enemyCount: 2 })).toBeGreaterThan(
      calculateBattleExp({ floor: 50, enemyCount: 1 })
    );
    expect(calculateBattleExp({ floor: 50, enemyCount: 3 })).toBeGreaterThan(
      calculateBattleExp({ floor: 50, enemyCount: 2 })
    );
  });

  it("applies deterministic class growth by level", () => {
    const lv1 = getBaseStatsForClassLevel("GUARDIAN", 1);
    const lv2 = getBaseStatsForClassLevel("GUARDIAN", 2);
    const lv10 = getBaseStatsForClassLevel("GUARDIAN", 10);

    expect(lv1).toEqual({ maxHp: 120, atk: 8, def: 10, spd: 8, maxMp: 20, mpRegen: 2 });
    expect(lv2.maxHp - lv1.maxHp).toBe(6);
    expect(lv2.def - lv1.def).toBe(1);
    expect(lv10).toEqual(getBaseStatsForClassLevel("GUARDIAN", 10));
  });

  it("applies EXP and levels up a character", () => {
    const toLevel3Exp = getTotalExpForLevel(3);
    const result = applyExperienceToCharacter(makeCharacter(), toLevel3Exp);

    expect(result.previousLevel).toBe(1);
    expect(result.newLevel).toBe(3);
    expect(result.leveledUpBy).toBe(2);
    expect(result.character.exp).toBe(toLevel3Exp);
    expect(result.character.level).toBe(3);
    expect(result.character.baseAtk).toBe(getBaseStatsForClassLevel("SWORDMAN", 3).atk);
  });

  it("does not heal current HP/MP on level up and clamps within new max", () => {
    const before = makeCharacter({ currentHp: 40, currentMp: 7 });
    const result = applyExperienceToCharacter(before, getTotalExpForLevel(5));
    expect(result.character.currentHp).toBe(40);
    expect(result.character.currentMp).toBe(7);
  });

  it("returns EXP progress helpers for current level", () => {
    const exp = getTotalExpForLevel(5) + 3;
    expect(getExpIntoCurrentLevel(exp, 5)).toBe(3);
    expect(getExpToNextLevel(exp, 5)).toBe(getExpRequiredForNextLevel(5) - 3);
  });

  it("ignores EXP gain beyond max level cap", () => {
    const capExp = getTotalExpForLevel(MAX_CHARACTER_LEVEL);
    const capped = makeCharacter({
      classId: "WITCH",
      level: MAX_CHARACTER_LEVEL,
      exp: capExp,
      ...(() => {
        const stats = getBaseStatsForClassLevel("WITCH", MAX_CHARACTER_LEVEL);
        return {
          baseMaxHp: stats.maxHp,
          baseAtk: stats.atk,
          baseDef: stats.def,
          baseSpd: stats.spd,
          baseMaxMp: stats.maxMp,
          baseMpRegen: stats.mpRegen,
          currentHp: stats.maxHp,
          currentMp: stats.maxMp,
        };
      })(),
    });

    const result = applyExperienceToCharacter(capped, 999999);
    expect(result.newLevel).toBe(MAX_CHARACTER_LEVEL);
    expect(result.gainedExp).toBe(0);
    expect(result.character.exp).toBe(capExp);
  });
});
