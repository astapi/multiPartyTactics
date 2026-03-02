export type ConsumableCategory = "healing_potion" | "mana_potion" | "status_cure";

export type ConsumableMasterItem = {
  id: string;
  category: ConsumableCategory;
  jp: string;
  en: string;
  priceGold: number;
  sortOrder: number;
};

export type ConsumableMasterBundle = {
  consumables: ConsumableMasterItem[];
};

export type ConsumableInventoryRecord = {
  itemId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

export type ConsumableShopCatalogItem = {
  itemId: string;
  priceGold: number;
  ownedQuantity: number;
};
