import { getDb } from "@/db/database";
import { INITIAL_GOLD, MAIN_WALLET_ID } from "@/constants/economy";
import { calculateShopPriceGold } from "@/game/equipment/shopPricing";
import { getEquipmentById, listEquipmentBySource } from "@/game/loot/equipmentMasterService";
import type { ShopCatalogItem } from "@/types/equipment";
import { generateId } from "@/utils/id";

type ShopCatalogRow = {
  base_item_id: string;
  price_gold: number;
  is_enabled: number;
  owned_quantity: number;
};

const ensureMainWalletTx = async (db: Awaited<ReturnType<typeof getDb>>): Promise<void> => {
  await db.runAsync(
    `INSERT OR IGNORE INTO wallets (id, gold, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [MAIN_WALLET_ID, INITIAL_GOLD]
  );
};

const seedShopCatalogTx = async (db: Awaited<ReturnType<typeof getDb>>): Promise<void> => {
  const shopItems = listEquipmentBySource("shop");
  for (const item of shopItems) {
    await db.runAsync(
      `INSERT OR IGNORE INTO shop_equipment_catalog
        (base_item_id, price_gold, is_enabled, updated_at)
       VALUES (?, ?, 1, CURRENT_TIMESTAMP)`,
      [item.id, calculateShopPriceGold(item)]
    );
  }
};

const mapCatalog = (row: ShopCatalogRow): ShopCatalogItem => ({
  baseItemId: row.base_item_id,
  priceGold: row.price_gold,
  isEnabled: row.is_enabled === 1,
  ownedQuantity: row.owned_quantity,
});

export type ShopPurchaseResult =
  | {
      ok: true;
      baseItemId: string;
      priceGold: number;
      walletGold: number;
    }
  | {
      ok: false;
      reason: "INSUFFICIENT_GOLD";
      baseItemId: string;
      priceGold: number;
      walletGold: number;
    };

export const shopEquipmentRepository = {
  async listCatalogWithOwnedCounts(): Promise<ShopCatalogItem[]> {
    const db = await getDb();
    await ensureMainWalletTx(db);
    await seedShopCatalogTx(db);
    const rows = await db.getAllAsync<ShopCatalogRow>(
      `SELECT
         c.base_item_id,
         c.price_gold,
         c.is_enabled,
         COALESCE(SUM(s.quantity), 0) AS owned_quantity
       FROM shop_equipment_catalog c
       LEFT JOIN equipment_inventory_stacks s
         ON s.base_item_id = c.base_item_id
        AND s.stats_key = ''
       WHERE c.is_enabled = 1
       GROUP BY c.base_item_id, c.price_gold, c.is_enabled
       ORDER BY c.base_item_id ASC`
    );
    return rows.map(mapCatalog);
  },

  async purchase(baseItemId: string): Promise<ShopPurchaseResult> {
    const item = getEquipmentById(baseItemId);
    if (item.source !== "shop") {
      throw new Error(`Only shop items can be purchased: ${baseItemId}`);
    }
    const db = await getDb();
    await db.execAsync("BEGIN;");
    try {
      await ensureMainWalletTx(db);
      await seedShopCatalogTx(db);

      const catalog = await db.getFirstAsync<{
        base_item_id: string;
        price_gold: number;
      }>(
        `SELECT base_item_id, price_gold
         FROM shop_equipment_catalog
         WHERE base_item_id = ? AND is_enabled = 1
         LIMIT 1`,
        [baseItemId]
      );
      if (!catalog) {
        throw new Error(`Shop item is disabled or missing from catalog: ${baseItemId}`);
      }

      const wallet = await db.getFirstAsync<{ gold: number }>(
        "SELECT gold FROM wallets WHERE id = ? LIMIT 1",
        [MAIN_WALLET_ID]
      );
      const walletGold = Math.max(0, Math.floor(wallet?.gold ?? 0));
      const priceGold = Math.max(0, Math.floor(catalog.price_gold));
      if (walletGold < priceGold) {
        await db.execAsync("ROLLBACK;");
        return {
          ok: false,
          reason: "INSUFFICIENT_GOLD",
          baseItemId,
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

      const grantKey = `${generateId("shop_purchase")}:${baseItemId}`;
      await db.runAsync(
        `INSERT INTO equipment_grants
          (grant_key, source_type, base_item_id, mutation_prefix_id, granted_stats_json, quantity, context_json, created_at)
         VALUES (?, 'SHOP_PURCHASE', ?, NULL, NULL, 1, ?, CURRENT_TIMESTAMP)`,
        [
          grantKey,
          baseItemId,
          JSON.stringify({
            baseItemId,
            priceGold,
          }),
        ]
      );
      await db.runAsync(
        `INSERT INTO equipment_inventory_stacks
          (base_item_id, mutation_prefix_id, mutation_prefix_key, stats_key, granted_stats_json, quantity, created_at, updated_at)
         VALUES (?, NULL, '', '', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(base_item_id, mutation_prefix_key, stats_key)
         DO UPDATE SET
           quantity = equipment_inventory_stacks.quantity + 1,
           updated_at = CURRENT_TIMESTAMP`,
        [baseItemId]
      );
      await db.runAsync(
        `INSERT INTO shop_purchase_logs
          (base_item_id, mutation_prefix_id, price_gold, quantity, purchased_at)
         VALUES (?, NULL, ?, 1, CURRENT_TIMESTAMP)`,
        [baseItemId, priceGold]
      );
      await db.execAsync("COMMIT;");

      return {
        ok: true,
        baseItemId,
        priceGold,
        walletGold: nextGold,
      };
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
