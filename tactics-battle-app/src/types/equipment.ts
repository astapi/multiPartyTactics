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

export type EquipmentSource = "shop" | "monster" | "chest";

export type EquipmentMasterItem = {
  id: string;
  category: EquipmentCategory;
  source: EquipmentSource;
  jp: string;
  en: string;
  can_mutate: boolean;
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
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

export type EquipmentGrantRecord = {
  grantKey: string;
  sourceType: EquipmentGrantSourceType;
  baseItemId: string;
  mutationPrefixId: string | null;
  quantity: number;
  contextJson: string;
  createdAt?: string;
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
  categoryWeights: Partial<Record<EquipmentCategory, number>>;
};

export type ResolvedChestLootConfig = {
  categoryWeights: Partial<Record<EquipmentCategory, number>>;
};
