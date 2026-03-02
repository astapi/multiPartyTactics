import { getDb } from "@/db/database";
import {
  getConsumableById,
  listConsumables,
} from "@/game/consumable/consumableMasterService";
import type { ConsumableShopCatalogItem } from "@/types/consumable";

const MAIN_WALLET_ID = "main";
const DEFAULT_GOLD = 12450;

const ensureMainWalletTx = async (
  db: Awaited<ReturnType<typeof getDb>>
): Promise<void> => {
  await db.runAsync(
    `INSERT OR IGNORE INTO wallets (id, gold, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [MAIN_WALLET_ID, DEFAULT_GOLD]
  );
};

export type ConsumablePurchaseResult =
  | { ok: true; itemId: string; priceGold: number; walletGold: number }
  | {
      ok: false;
      reason: "INSUFFICIENT_GOLD";
      itemId: string;
      priceGold: number;
      walletGold: number;
    };

export const shopConsumableRepository = {
  async listCatalogWithOwnedCounts(): Promise<ConsumableShopCatalogItem[]> {
    const db = await getDb();
    const masterItems = listConsumables();
    const rows = await db.getAllAsync<{ item_id: string; quantity: number }>(
      "SELECT item_id, quantity FROM consumable_inventory"
    );
    const ownedMap = new Map(rows.map((r) => [r.item_id, r.quantity]));
    return masterItems.map((item) => ({
      itemId: item.id,
      priceGold: item.priceGold,
      ownedQuantity: ownedMap.get(item.id) ?? 0,
    }));
  },

  async purchase(itemId: string): Promise<ConsumablePurchaseResult> {
    const item = getConsumableById(itemId);
    const priceGold = item.priceGold;
    const db = await getDb();
    await db.execAsync("BEGIN;");
    try {
      await ensureMainWalletTx(db);

      const wallet = await db.getFirstAsync<{ gold: number }>(
        "SELECT gold FROM wallets WHERE id = ? LIMIT 1",
        [MAIN_WALLET_ID]
      );
      const walletGold = Math.max(0, Math.floor(wallet?.gold ?? 0));
      if (walletGold < priceGold) {
        await db.execAsync("ROLLBACK;");
        return {
          ok: false,
          reason: "INSUFFICIENT_GOLD",
          itemId,
          priceGold,
          walletGold,
        };
      }

      const nextGold = walletGold - priceGold;
      await db.runAsync(
        `UPDATE wallets
         SET gold = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nextGold, MAIN_WALLET_ID]
      );

      await db.runAsync(
        `INSERT INTO consumable_inventory (item_id, quantity, created_at, updated_at)
         VALUES (?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(item_id)
         DO UPDATE SET
           quantity = consumable_inventory.quantity + 1,
           updated_at = CURRENT_TIMESTAMP`,
        [itemId]
      );

      await db.runAsync(
        `INSERT INTO shop_purchase_logs
          (base_item_id, mutation_prefix_id, price_gold, quantity, purchased_at)
         VALUES (?, NULL, ?, 1, CURRENT_TIMESTAMP)`,
        [itemId, priceGold]
      );

      await db.execAsync("COMMIT;");
      return { ok: true, itemId, priceGold, walletGold: nextGold };
    } catch (error) {
      try {
        await db.execAsync("ROLLBACK;");
      } catch {
        // ignore rollback failure
      }
      throw error;
    }
  },
};
