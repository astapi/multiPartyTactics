import { createSeededRng } from "@/utils/rng";
import {
  buildEquipmentDisplayName,
  getEquipmentById,
  isMutationApplicable,
  listEquipmentBySource,
  listMutationPrefixes,
} from "@/game/loot/equipmentMasterService";
import { resolveChestLootConfig, resolveMonsterLootConfig } from "@/game/loot/lootTableService";
import type {
  EquipmentCategory,
  EquipmentMasterItem,
  EquipmentReward,
  MonsterDropRollParams,
  TreasureChestRollParams,
} from "@/types/equipment";

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const pickWeightedCategory = (
  weights: Partial<Record<EquipmentCategory, number>>,
  availableCategories: Set<EquipmentCategory>,
  rng: () => number
): EquipmentCategory => {
  const entries = (Object.entries(weights) as Array<[EquipmentCategory, number]>)
    .filter(([category, weight]) => availableCategories.has(category) && (weight ?? 0) > 0);

  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) {
    throw new Error("No positive category weights available for loot roll.");
  }

  let roll = rng() * totalWeight;
  for (const [category, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return category;
  }
  return entries[entries.length - 1][0];
};

const pickOne = <T>(list: T[], rng: () => number): T => {
  if (list.length === 0) throw new Error("Cannot pick from empty list.");
  return list[Math.floor(rng() * list.length)] ?? list[list.length - 1];
};

const toReward = (
  baseItem: EquipmentMasterItem,
  mutationPrefixId: string | null,
  sourceType: EquipmentReward["sourceType"],
  grantKey: string
): EquipmentReward => ({
  baseItemId: baseItem.id,
  mutationPrefixId,
  sourceType,
  grantKey,
  displayName: buildEquipmentDisplayName(baseItem.id, mutationPrefixId),
  category: baseItem.category,
});

const getCandidatesByCategory = (source: "monster" | "chest") => {
  const all = listEquipmentBySource(source);
  const map = new Map<EquipmentCategory, EquipmentMasterItem[]>();
  for (const item of all) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return map;
};

const buildChestTierCandidates = () => {
  const all = listEquipmentBySource("chest");
  const tierMap = new Map<number, Map<EquipmentCategory, EquipmentMasterItem[]>>();
  for (const item of all) {
    const tier = item.chestTier;
    if (tier == null) continue;
    if (!tierMap.has(tier)) tierMap.set(tier, new Map());
    const catMap = tierMap.get(tier)!;
    const list = catMap.get(item.category) ?? [];
    list.push(item);
    catMap.set(item.category, list);
  }
  return tierMap;
};

const getChestTier = (floor: number): number =>
  Math.min(190, Math.ceil(Math.max(1, floor) / 10) * 10);

const CHEST_TIER_CANDIDATES = buildChestTierCandidates();
const MONSTER_CANDIDATES = getCandidatesByCategory("monster");

export const rollTreasureChestEquipment = (params: TreasureChestRollParams): EquipmentReward => {
  const floor = Math.max(1, params.floor);
  const seed =
    (params.explorationSeed ^ Math.imul(params.tick, 131071) ^ Math.imul(floor, 8191) ^ hashString(params.dungeonId)) >>> 0;
  const rng = createSeededRng(seed);
  const config = resolveChestLootConfig(params.dungeonId, floor);

  const tier = getChestTier(floor);
  const tierCandidates = CHEST_TIER_CANDIDATES.get(tier);
  if (!tierCandidates) throw new Error(`No chest candidates for tier ${tier}`);

  const category = pickWeightedCategory(config.categoryWeights, new Set(tierCandidates.keys()), rng);
  const candidates = tierCandidates.get(category) ?? [];
  const item = pickOne(candidates, rng);
  const grantKey = `treasure:${params.dungeonId}:${floor}:${params.explorationSeed}:${params.tick}`;
  return toReward(item, null, "TREASURE_CHEST", grantKey);
};

export const rollMonsterDrops = (
  params: MonsterDropRollParams
): Array<{ enemyIndex: number; reward: EquipmentReward | null }> => {
  const floor = Math.max(1, params.floor);
  const seed =
    (params.seed ^ hashString(params.dungeonId) ^ hashString(params.battleSessionId) ^ Math.imul(floor, 524287)) >>> 0;
  const rng = createSeededRng(seed);
  const config = resolveMonsterLootConfig(params.dungeonId, floor);
  const mutationPrefixes = listMutationPrefixes();
  const availableMonsterCategories = new Set(MONSTER_CANDIDATES.keys());

  return params.encounter.enemies.map((_, enemyIndex) => {
    if (rng() >= config.perEnemyDropChance) {
      return { enemyIndex, reward: null };
    }

    const category = pickWeightedCategory(config.categoryWeights, availableMonsterCategories, rng);
    const candidates = MONSTER_CANDIDATES.get(category) ?? [];
    const item = pickOne(candidates, rng);

    let mutationPrefixId: string | null = null;
    if (item.can_mutate && isMutationApplicable(item.id) && rng() < config.mutationChance) {
      mutationPrefixId = pickOne(mutationPrefixes, rng).id;
    }

    return {
      enemyIndex,
      reward: toReward(item, mutationPrefixId, "MONSTER_DROP", `monster_drop:${params.battleSessionId}:${enemyIndex}`),
    };
  });
};
