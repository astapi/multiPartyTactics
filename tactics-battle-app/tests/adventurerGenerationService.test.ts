import { describe, expect, it, vi } from "vitest";

vi.mock("@/constants/classes", () => {
  return {
    CLASS_MASTER: [
      { id: "GUARDIAN", name: "Guardian", description: "", image: 1, baseStats: { maxHp: 120, atk: 8, def: 10, spi: 5, spd: 8, maxMp: 20, mpRegen: 2 }, hiringCost: 5000 },
      { id: "SWORDMAN", name: "Swordman", description: "", image: 1, baseStats: { maxHp: 100, atk: 11, def: 8, spi: 6, spd: 10, maxMp: 22, mpRegen: 2 }, hiringCost: 5500 },
      { id: "BERSERKER", name: "Berserker", description: "", image: 1, baseStats: { maxHp: 110, atk: 14, def: 6, spi: 4, spd: 9, maxMp: 18, mpRegen: 2 }, hiringCost: 6000 },
      { id: "CLERIC", name: "Cleric", description: "", image: 1, baseStats: { maxHp: 80, atk: 5, def: 6, spi: 13, spd: 10, maxMp: 35, mpRegen: 2 }, hiringCost: 7000 },
      { id: "WITCH", name: "Witch", description: "", image: 1, baseStats: { maxHp: 75, atk: 6, def: 5, spi: 15, spd: 11, maxMp: 30, mpRegen: 2 }, hiringCost: 6500 },
      { id: "THIEF", name: "Thief", description: "", image: 1, baseStats: { maxHp: 90, atk: 12, def: 5, spi: 6, spd: 12, maxMp: 25, mpRegen: 2 }, hiringCost: 5500 },
      { id: "PORTER", name: "Porter", description: "", image: 1, baseStats: { maxHp: 95, atk: 7, def: 7, spi: 7, spd: 9, maxMp: 18, mpRegen: 2 }, hiringCost: 4500 },
    ],
  };
});
import { adventurerGenerationService } from "@/features/guild/adventurerGenerationService";

describe("adventurerGenerationService", () => {
  it("generates deterministic candidates from the same seed", () => {
    const a = adventurerGenerationService.generateCandidates(12345);
    const b = adventurerGenerationService.generateCandidates(12345);

    expect(a).toHaveLength(4);
    expect(a.map((candidate) => ({
      name: candidate.name,
      classId: candidate.classId,
      level: candidate.level,
      age: candidate.age,
      growthMultiplier: candidate.growthMultiplier,
      traitIds: candidate.traitIds,
      priceGold: candidate.priceGold,
    }))).toEqual(
      b.map((candidate) => ({
        name: candidate.name,
        classId: candidate.classId,
        level: candidate.level,
        age: candidate.age,
        growthMultiplier: candidate.growthMultiplier,
        traitIds: candidate.traitIds,
        priceGold: candidate.priceGold,
      }))
    );
  });

  it("keeps generated candidates within configured ranges", () => {
    const candidates = adventurerGenerationService.generateCandidates(98765);

    for (const candidate of candidates) {
      expect(candidate.level).toBeGreaterThanOrEqual(1);
      expect(candidate.level).toBeLessThanOrEqual(15);
      expect(candidate.age).toBeGreaterThanOrEqual(16);
      expect(candidate.age).toBeLessThanOrEqual(49);
      expect([1, 0.95]).toContain(candidate.growthMultiplier);
      expect(candidate.innateHpRate).toBeGreaterThanOrEqual(0.9);
      expect(candidate.innateHpRate).toBeLessThanOrEqual(1.1);
      expect(candidate.innateAtkBonus).toBeGreaterThanOrEqual(-5);
      expect(candidate.innateAtkBonus).toBeLessThanOrEqual(5);
      expect(candidate.innateDefBonus).toBeGreaterThanOrEqual(-5);
      expect(candidate.innateDefBonus).toBeLessThanOrEqual(5);
      expect(candidate.innateSpiBonus).toBeGreaterThanOrEqual(-5);
      expect(candidate.innateSpiBonus).toBeLessThanOrEqual(5);
      expect(candidate.innateSpdBonus).toBeGreaterThanOrEqual(-3);
      expect(candidate.innateSpdBonus).toBeLessThanOrEqual(3);
      if (candidate.age >= 35) {
        expect(candidate.growthMultiplier).toBe(0.95);
      } else {
        expect(candidate.growthMultiplier).toBe(1);
      }
      if (candidate.traitIds.includes("HERO")) {
        const classBaseCost =
          candidate.classId === "CLERIC"
            ? 7000
            : candidate.classId === "WITCH"
              ? 6500
              : candidate.classId === "BERSERKER"
                ? 6000
                : candidate.classId === "PORTER"
                  ? 4500
                  : 5500;
        expect(candidate.priceGold).toBe(
          Math.floor((classBaseCost + (candidate.level - 1) * 120 + 3000) / 3)
        );
      }
    }
  });
});
