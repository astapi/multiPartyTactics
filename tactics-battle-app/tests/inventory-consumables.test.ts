import { describe, expect, it, vi } from "vitest";
import { buildOwnedConsumableRows } from "@/features/inventory/consumableRows";
import type {
  ConsumableInventoryRecord,
  ConsumableMasterItem,
} from "@/types/consumable";

const MASTER_ITEMS: ConsumableMasterItem[] = [
  {
    id: "mana_potion_s",
    category: "mana_potion",
    jp: "魔力回復薬（小）",
    en: "Mana Potion (S)",
    priceGold: 60,
    sortOrder: 6,
  },
  {
    id: "healing_potion_s",
    category: "healing_potion",
    jp: "体力回復薬（小）",
    en: "Healing Potion (S)",
    priceGold: 50,
    sortOrder: 1,
  },
  {
    id: "antidote",
    category: "status_cure",
    jp: "どくけし",
    en: "Antidote",
    priceGold: 30,
    sortOrder: 11,
  },
];

const makeInventory = (itemId: string, quantity: number): ConsumableInventoryRecord => ({
  itemId,
  quantity,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("buildOwnedConsumableRows", () => {
  it("sorts rows by master sortOrder then itemId", () => {
    const rows = buildOwnedConsumableRows({
      inventoryRows: [
        makeInventory("antidote", 2),
        makeInventory("mana_potion_s", 3),
        makeInventory("healing_potion_s", 1),
      ],
      locale: "en",
      masterItems: MASTER_ITEMS,
    });

    expect(rows.map((row) => row.itemId)).toEqual([
      "healing_potion_s",
      "mana_potion_s",
      "antidote",
    ]);
  });

  it("skips unknown item_id and calls warning callback", () => {
    const warn = vi.fn();
    const rows = buildOwnedConsumableRows({
      inventoryRows: [
        makeInventory("healing_potion_s", 1),
        makeInventory("unknown_item", 9),
      ],
      locale: "ja",
      masterItems: MASTER_ITEMS,
      onUnknownItemId: warn,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.itemId).toBe("healing_potion_s");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("unknown_item");
  });

  it("returns empty array when inventory is empty", () => {
    const rows = buildOwnedConsumableRows({
      inventoryRows: [],
      locale: "ja",
      masterItems: MASTER_ITEMS,
    });
    expect(rows).toEqual([]);
  });
});
