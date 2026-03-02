import { getDb } from "@/db/database";
import type { ConsumableInventoryRecord } from "@/types/consumable";

type ConsumableInventoryRow = {
  item_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
};

const mapRecord = (row: ConsumableInventoryRow): ConsumableInventoryRecord => ({
  itemId: row.item_id,
  quantity: row.quantity,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const consumableInventoryRepository = {
  async listAll(): Promise<ConsumableInventoryRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<ConsumableInventoryRow>(
      "SELECT * FROM consumable_inventory ORDER BY item_id ASC"
    );
    return rows.map(mapRecord);
  },

  async getQuantity(itemId: string): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ quantity: number }>(
      "SELECT quantity FROM consumable_inventory WHERE item_id = ? LIMIT 1",
      [itemId]
    );
    return row?.quantity ?? 0;
  },

  async addQuantity(itemId: string, quantity: number): Promise<void> {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("addQuantity requires a positive quantity");
    }
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO consumable_inventory (item_id, quantity, created_at, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(item_id)
       DO UPDATE SET
         quantity = consumable_inventory.quantity + excluded.quantity,
         updated_at = CURRENT_TIMESTAMP`,
      [itemId, quantity]
    );
  },

  async consumeQuantity(itemId: string, quantity: number): Promise<boolean> {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("consumeQuantity requires a positive quantity");
    }
    const db = await getDb();
    const current = await db.getFirstAsync<{ quantity: number }>(
      "SELECT quantity FROM consumable_inventory WHERE item_id = ? LIMIT 1",
      [itemId]
    );
    if (!current || current.quantity < quantity) return false;
    const next = current.quantity - quantity;
    if (next <= 0) {
      await db.runAsync(
        "DELETE FROM consumable_inventory WHERE item_id = ?",
        [itemId]
      );
    } else {
      await db.runAsync(
        `UPDATE consumable_inventory
         SET quantity = ?, updated_at = CURRENT_TIMESTAMP
         WHERE item_id = ?`,
        [next, itemId]
      );
    }
    return true;
  },
};
