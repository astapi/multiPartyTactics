import lootTableData from "@/data/equipmentLootTable.json";
import type {
  EquipmentCategory,
  ResolvedChestLootConfig,
  ResolvedMonsterLootConfig,
} from "@/types/equipment";

type CategoryWeights = Partial<Record<EquipmentCategory, number>>;

type LootTableJson = {
  defaults: {
    monster: {
      perEnemyDropChance: number;
      mutationChance: number;
    };
    chest: {
      categoryWeights: CategoryWeights;
    };
  };
  floorBands: Array<{
    id: string;
    minFloor: number;
    maxFloor: number;
    monster?: Partial<ResolvedMonsterLootConfig>;
    chest?: Partial<ResolvedChestLootConfig>;
  }>;
  dungeonOverrides: Array<{
    dungeonId: string;
    monster?: Partial<ResolvedMonsterLootConfig>;
    chest?: Partial<ResolvedChestLootConfig>;
  }>;
};

const raw = lootTableData as LootTableJson;

const mergeWeights = (base: CategoryWeights, override?: CategoryWeights): CategoryWeights => ({
  ...base,
  ...(override ?? {}),
});

const validateChance = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
  return value;
};

const validateWeights = (weights: CategoryWeights, label: string): CategoryWeights => {
  for (const [category, value] of Object.entries(weights)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid weight for ${label}.${category}`);
    }
  }
  return weights;
};

const findFloorBand = (floor: number) => raw.floorBands.find((band) => floor >= band.minFloor && floor <= band.maxFloor);
const findDungeonOverride = (dungeonId: string) => raw.dungeonOverrides.find((entry) => entry.dungeonId === dungeonId);

export const resolveMonsterLootConfig = (dungeonId: string, floor: number): ResolvedMonsterLootConfig => {
  const floorBand = findFloorBand(Math.max(1, floor));
  const dungeonOverride = findDungeonOverride(dungeonId);

  const perEnemyDropChance = validateChance(
    dungeonOverride?.monster?.perEnemyDropChance ?? floorBand?.monster?.perEnemyDropChance ?? raw.defaults.monster.perEnemyDropChance,
    "monster.perEnemyDropChance"
  );
  const mutationChance = validateChance(
    dungeonOverride?.monster?.mutationChance ?? floorBand?.monster?.mutationChance ?? raw.defaults.monster.mutationChance,
    "monster.mutationChance"
  );
  return { perEnemyDropChance, mutationChance };
};

export const resolveChestLootConfig = (dungeonId: string, floor: number): ResolvedChestLootConfig => {
  const floorBand = findFloorBand(Math.max(1, floor));
  const dungeonOverride = findDungeonOverride(dungeonId);
  const categoryWeights = validateWeights(
    mergeWeights(
      mergeWeights(raw.defaults.chest.categoryWeights, floorBand?.chest?.categoryWeights),
      dungeonOverride?.chest?.categoryWeights
    ),
    "chest.categoryWeights"
  );
  return { categoryWeights };
};
