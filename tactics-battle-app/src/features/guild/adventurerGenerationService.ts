import { getRandomConstellationId } from "@/constants/constellations";
import { CLASS_MASTER } from "@/constants/classes";
import { getCharacterStatsAtLevel } from "@/game/progression";
import type { ClassId, TavernCandidateRecord } from "@/types/models";
import { generateId } from "@/utils/id";
import { createSeededRng } from "@/utils/rng";
import { getClassInnateTraits, hasTrait, rollRandomTrait } from "./traits";

const AUTO_NAMES = [
  "アデル",
  "カイン",
  "リゼ",
  "ノア",
  "セナ",
  "ユノ",
  "レイナ",
  "シオン",
  "ミラ",
  "ロア",
  "カナ",
  "ネル",
];

const MIN_LEVEL = 1;
const MAX_LEVEL = 29;
const MIN_AGE = 16;
const MAX_AGE = 49;

const pickRandom = <T>(list: readonly T[], rng: () => number): T =>
  list[Math.floor(rng() * list.length)] ?? list[0];

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const rollInt = (min: number, max: number, rng: () => number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

const getGrowthMultiplier = (age: number): number => (age >= 35 ? 0.95 : 1);
export const getAgeGrowthMultiplier = getGrowthMultiplier;

const buildUniqueName = (usedNames: Set<string>, rng: () => number): string => {
  for (let i = 0; i < 10; i += 1) {
    const name = pickRandom(AUTO_NAMES, rng);
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  const fallback = `${pickRandom(AUTO_NAMES, rng)}${usedNames.size + 1}`;
  usedNames.add(fallback);
  return fallback;
};

const getClassBaseCost = (classId: ClassId): number =>
  CLASS_MASTER.find((entry) => entry.id === classId)?.hiringCost ?? 5000;

const createCandidate = (
  rng: () => number,
  usedNames: Set<string>,
  generatedAt: string
): TavernCandidateRecord => {
  const classId = pickRandom(CLASS_MASTER, rng).id;
  const age = rollInt(MIN_AGE, MAX_AGE, rng);
  const growthMultiplier = getGrowthMultiplier(age);
  const constellationId = getRandomConstellationId(rng);
  const traitIds = [...getClassInnateTraits(classId), ...rollRandomTrait(rng)];
  const level = rollInt(MIN_LEVEL, MAX_LEVEL, rng);
  const innateHpRate = clamp(1 + (rng() * 0.2 - 0.1), 0.9, 1.1);
  const innateAtkBonus = rollInt(-5, 5, rng);
  const innateDefBonus = rollInt(-5, 5, rng);
  const innateSpiBonus = rollInt(-5, 5, rng);
  const innateSpdBonus = rollInt(-3, 3, rng);
  const stats = getCharacterStatsAtLevel(
    {
      classId,
      constellationId,
      growthMultiplier,
      innateHpRate,
      innateAtkBonus,
      innateDefBonus,
      innateSpiBonus,
      innateSpdBonus,
    },
    level
  );

  return {
    id: generateId("tavern"),
    name: buildUniqueName(usedNames, rng),
    classId,
    constellationId,
    level,
    age,
    growthMultiplier,
    traitIds,
    priceGold:
      getClassBaseCost(classId) +
      (level - 1) * 120 +
      (hasTrait(traitIds, "HERO") ? 3000 : 0),
    baseMaxHp: stats.maxHp,
    baseAtk: stats.atk,
    baseDef: stats.def,
    baseSpi: stats.spi,
    baseSpd: stats.spd,
    baseMaxMp: stats.maxMp,
    baseMpRegen: stats.mpRegen,
    innateHpRate,
    innateAtkBonus,
    innateDefBonus,
    innateSpiBonus,
    innateSpdBonus,
    generatedAt,
  };
};

export const adventurerGenerationService = {
  generateCandidates(seed: number, count = 4, generatedAt = new Date().toISOString()): TavernCandidateRecord[] {
    const rng = createSeededRng(seed);
    const usedNames = new Set<string>();

    return Array.from({ length: count }, () => createCandidate(rng, usedNames, generatedAt));
  },

  getAgeGrowthMultiplier,
};
