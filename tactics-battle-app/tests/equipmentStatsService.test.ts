import { describe, expect, it } from "vitest";
import {
  computeCharacterDerivedStats,
  formatStatLines,
  normalizeEquipmentStats,
  sumEquipmentStats,
  toBaseResource,
  toBattleResource,
} from "@/game/equipment/equipmentStatsService";

const sampleCharacter = {
  id: "c1",
  slotIndex: 0,
  name: "Alicia",
  classId: "SWORDMAN" as const,
  constellationId: "ARIES" as const,
  level: 1,
  exp: 0,
  baseMaxHp: 100,
  baseAtk: 11,
  baseDef: 8,
  baseSpd: 10,
  baseMaxMp: 22,
  baseMpRegen: 2,
  currentHp: 70,
  currentMp: 12,
};

describe("game/equipment/equipmentStatsService", () => {
  it("normalizes undefined stats to zero", () => {
    expect(normalizeEquipmentStats()).toEqual({
      hp: 0,
      atk: 0,
      def: 0,
      spi: 0,
      mp: 0,
      spd: 0,
      hpRegen: 0,
      mpRegen: 0,
    });
  });

  it("sums multiple stat objects", () => {
    expect(sumEquipmentStats([{ atk: 3, spd: 2 }, { atk: 4, hp: 5 }, undefined])).toEqual({
      hp: 5,
      atk: 7,
      def: 0,
      spi: 0,
      mp: 0,
      spd: 2,
      hpRegen: 0,
      mpRegen: 0,
    });
  });

  it("computes base/bonus/total and battle stats from equipped items", () => {
    const derived = computeCharacterDerivedStats(sampleCharacter, {
      weapon: {
        characterId: sampleCharacter.id,
        slotType: "weapon",
        baseItemId: "bronze_sword",
        mutationPrefixId: null,
        equippedAt: "2026-03-01T00:00:00.000Z",
      },
      armor: {
        characterId: sampleCharacter.id,
        slotType: "armor",
        baseItemId: "iron_shield",
        mutationPrefixId: null,
        equippedAt: "2026-03-01T00:00:00.000Z",
      },
    });

    expect(derived.base).toMatchObject({ hp: 100, atk: 11, def: 8, mp: 22, spd: 10, mpRegen: 2 });
    expect(derived.bonus).toMatchObject({ hp: 3, atk: 5, def: 5, mp: 0, spd: 0, mpRegen: 0 });
    expect(derived.total).toMatchObject({ hp: 103, atk: 16, def: 13, mp: 22, spd: 10, mpRegen: 2 });
    expect(derived.battle).toEqual({ maxHp: 103, atk: 16, def: 13, spd: 10, maxMp: 22, mpRegen: 2 });
  });

  it("formats non-zero stat lines", () => {
    expect(formatStatLines({ atk: 5, def: 2, mpRegen: 1 }, "en")).toEqual([
      "+5 ATK",
      "+2 DEF",
      "+1 MP Regen",
    ]);
  });

  it("converts HP/MP between base and battle spaces", () => {
    const battleCurrentHp = toBattleResource(70, 100, 3);
    expect(battleCurrentHp).toBe(73);
    expect(toBaseResource(battleCurrentHp, 100, 3)).toBe(70);
  });
});
