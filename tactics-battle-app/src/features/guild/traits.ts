import type { AdventurerTraitId, ClassId } from "@/types/models";

export type AdventurerTraitDefinition = {
  id: AdventurerTraitId;
  nameJa: string;
  descriptionJa: string;
  isRare?: boolean;
  classOnly?: ClassId;
};

export const ADVENTURER_TRAITS: Record<AdventurerTraitId, AdventurerTraitDefinition> = {
  LOUD_FOOTSTEPS: {
    id: "LOUD_FOOTSTEPS",
    nameJa: "足音が大きい",
    descriptionJa: "エンカウント率が10%上昇する",
  },
  LOUD_VOICE: {
    id: "LOUD_VOICE",
    nameJa: "声がうるさい",
    descriptionJa: "エンカウント率が10%上昇する",
  },
  MENTAL_RESIST: {
    id: "MENTAL_RESIST",
    nameJa: "精神汚染耐性",
    descriptionJa: "精神汚染の進行速度が25%低下する",
  },
  MENTAL_WEAKNESS: {
    id: "MENTAL_WEAKNESS",
    nameJa: "精神汚染耐性×",
    descriptionJa: "精神汚染の進行速度が25%上昇する",
  },
  HERO: {
    id: "HERO",
    nameJa: "勇者",
    descriptionJa: "パーティ全体の最大HPが20%上昇する",
    isRare: true,
  },
  PORTER: {
    id: "PORTER",
    nameJa: "ポーター",
    descriptionJa: "ダンジョンで持ち帰れるアイテム数が2増える",
    classOnly: "PORTER",
  },
  LUCKY_DROP: {
    id: "LUCKY_DROP",
    nameJa: "運気UP",
    descriptionJa: "アイテムDrop率が10%上昇する",
    classOnly: "THIEF",
  },
};

const RANDOM_TRAIT_POOL: AdventurerTraitId[] = [
  "LOUD_FOOTSTEPS",
  "LOUD_VOICE",
  "MENTAL_RESIST",
  "MENTAL_WEAKNESS",
];

export const getTraitLabel = (traitId: AdventurerTraitId): string =>
  ADVENTURER_TRAITS[traitId]?.nameJa ?? traitId;

export const getClassInnateTraits = (classId: ClassId): AdventurerTraitId[] => {
  const traits: AdventurerTraitId[] = [];
  if (classId === "PORTER") traits.push("PORTER");
  if (classId === "THIEF") traits.push("LUCKY_DROP");
  return traits;
};

export const rollRandomTrait = (rng: () => number): AdventurerTraitId[] => {
  if (rng() > 0.35) return [];
  if (rng() <= 0.05) return ["HERO"];
  const index = Math.floor(rng() * RANDOM_TRAIT_POOL.length);
  return [RANDOM_TRAIT_POOL[index] ?? RANDOM_TRAIT_POOL[0]];
};

export const hasTrait = (
  traitIds: readonly string[] | undefined,
  traitId: AdventurerTraitId
): boolean => (traitIds ?? []).includes(traitId);
