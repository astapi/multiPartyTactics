import type { EncounterResult } from "@/game/encounter";

export type EquipmentCategory =
  | "one_handed_sword"
  | "dagger"
  | "throwing_knife"
  | "two_handed_axe"
  | "two_handed_hammer"
  | "bow"
  | "staff"
  | "shield";

export type EquipmentSlot = "weapon" | "armor";

export type ShieldSize = "small" | "large";

export type EquipmentSource = "shop" | "monster" | "chest";

export type EquipmentStats = {
  hp?: number;
  atk?: number;
  def?: number;
  spi?: number;
  mp?: number;
  spd?: number;
  hpRegen?: number;
  mpRegen?: number;
};

export type ResolvedEquipmentStats = {
  hp: number;
  atk: number;
  def: number;
  spi: number;
  mp: number;
  spd: number;
  hpRegen: number;
  mpRegen: number;
};

export type EquipmentMasterItem = {
  id: string;
  category: EquipmentCategory;
  shieldSize?: ShieldSize;
  source: EquipmentSource;
  jp: string;
  en: string;
  can_mutate: boolean;
  chestTier?: number;
  stats?: EquipmentStats;
};

export type MutationPrefix = {
  id: string;
  jp: string;
  en: string;
};

export type EquipmentMasterBundle = {
  equipment: EquipmentMasterItem[];
  mutation_prefixes: MutationPrefix[];
  mutation_applicable: {
    rule: string;
    item_ids: string[];
  };
};

export type EquipmentGrantSourceType =
  | "MONSTER_DROP"
  | "TREASURE_CHEST"
  | "SHOP_PURCHASE"
  | "ADMIN";

export type EquipmentReward = {
  baseItemId: string;
  mutationPrefixId: string | null;
  grantedStats?: EquipmentStats | null;
  sourceType: Extract<EquipmentGrantSourceType, "MONSTER_DROP" | "TREASURE_CHEST">;
  grantKey: string;
  displayName: {
    jp: string;
    en: string;
  };
  category: EquipmentCategory;
};

export type EquipmentStackRecord = {
  id: number;
  baseItemId: string;
  mutationPrefixId: string | null;
  grantedStats?: EquipmentStats | null;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

export type CharacterEquipmentRecord = {
  characterId: string;
  slotType: EquipmentSlot;
  baseItemId: string;
  mutationPrefixId: string | null;
  grantedStats?: EquipmentStats | null;
  equippedAt: string;
};

export type EquipmentGrantRecord = {
  grantKey: string;
  sourceType: EquipmentGrantSourceType;
  baseItemId: string;
  mutationPrefixId: string | null;
  grantedStats?: EquipmentStats | null;
  quantity: number;
  contextJson: string;
  createdAt?: string;
};

export type ShopCatalogItem = {
  baseItemId: string;
  priceGold: number;
  isEnabled: boolean;
  ownedQuantity: number;
};

export type WalletRecord = {
  id: string;
  gold: number;
  updatedAt: string;
};

export type TreasureChestRollParams = {
  dungeonId: string;
  floor: number;
  explorationSeed: number;
  tick: number;
};

export type MonsterDropRollParams = {
  dungeonId: string;
  floor: number;
  battleSessionId: string;
  encounter: EncounterResult;
  seed: number;
};

export type ResolvedMonsterLootConfig = {
  perEnemyDropChance: number;
  mutationChance: number;
};

export type ResolvedChestLootConfig = {
  categoryWeights: Partial<Record<EquipmentCategory, number>>;
};

export type MonsterDropTableEntry = {
  enemyId: string;
  gold: number;
  baseItemIds: string[];
};
