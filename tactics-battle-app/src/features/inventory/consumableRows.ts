import { listConsumables } from "@/game/consumable/consumableMasterService";
import type {
  ConsumableCategory,
  ConsumableInventoryRecord,
  ConsumableMasterItem,
} from "@/types/consumable";

export type OwnedConsumableRow = {
  key: string;
  itemId: string;
  displayName: string;
  category: ConsumableCategory;
  quantity: number;
  sortOrder: number;
};

type BuildOwnedConsumableRowsInput = {
  inventoryRows: ConsumableInventoryRecord[];
  locale: string;
  masterItems?: ConsumableMasterItem[];
  onUnknownItemId?: (itemId: string) => void;
};

export const buildOwnedConsumableRows = (
  input: BuildOwnedConsumableRowsInput
): OwnedConsumableRow[] => {
  const masterItems = input.masterItems ?? listConsumables();
  const masterById = new Map(masterItems.map((item) => [item.id, item] as const));
  const rows: OwnedConsumableRow[] = [];

  for (const record of input.inventoryRows) {
    const item = masterById.get(record.itemId);
    if (!item) {
      if (input.onUnknownItemId) {
        input.onUnknownItemId(record.itemId);
      } else {
        console.warn(`[inventory] unknown consumable item id: ${record.itemId}`);
      }
      continue;
    }
    rows.push({
      key: record.itemId,
      itemId: record.itemId,
      displayName: input.locale === "ja" ? item.jp : item.en,
      category: item.category,
      quantity: record.quantity,
      sortOrder: item.sortOrder,
    });
  }

  rows.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.itemId.localeCompare(b.itemId);
  });
  return rows;
};
