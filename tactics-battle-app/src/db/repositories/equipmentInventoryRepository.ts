import { getDb } from "@/db/database";
import { parseEquipmentStatsJson, toEquipmentStatsKey } from "@/game/equipment/equipmentStatsService";
import type { EquipmentGrantRecord, EquipmentStackRecord } from "@/types/equipment";

const mapStack = (row: any): EquipmentStackRecord => ({
  id: row.id,
  baseItemId: row.base_item_id,
  mutationPrefixId: row.mutation_prefix_id ?? null,
  grantedStats: parseEquipmentStatsJson(row.granted_stats_json),
  quantity: row.quantity,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toMutationPrefixKey = (mutationPrefixId: string | null): string => mutationPrefixId ?? "";

const isUniqueGrantConstraintError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("equipment_grants.grant_key") || message.includes("UNIQUE constraint failed");
};

export const equipmentInventoryRepository = {
  async listStacks(): Promise<EquipmentStackRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM equipment_inventory_stacks
       ORDER BY base_item_id ASC, mutation_prefix_id ASC`
    );
    return rows.map(mapStack);
  },

  async getStack(
    baseItemId: string,
    mutationPrefixId: string | null,
    grantedStats?: EquipmentGrantRecord["grantedStats"]
  ): Promise<EquipmentStackRecord | null> {
    const db = await getDb();
    const mutationPrefixKey = toMutationPrefixKey(mutationPrefixId);
    const statsKey = toEquipmentStatsKey(grantedStats);
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM equipment_inventory_stacks
       WHERE base_item_id = ?
         AND mutation_prefix_key = ?
         AND stats_key = ?
       LIMIT 1`,
      [baseItemId, mutationPrefixKey, statsKey]
    );
    return row ? mapStack(row) : null;
  },

  async addQuantity(
    baseItemId: string,
    mutationPrefixId: string | null,
    quantity: number,
    grantedStats?: EquipmentGrantRecord["grantedStats"]
  ): Promise<void> {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("addQuantity requires a positive quantity");
    }
    const db = await getDb();
    const mutationPrefixKey = toMutationPrefixKey(mutationPrefixId);
    const statsKey = toEquipmentStatsKey(grantedStats);
    const grantedStatsJson = statsKey ? JSON.stringify(grantedStats) : null;
    await db.runAsync(
      `INSERT INTO equipment_inventory_stacks
        (base_item_id, mutation_prefix_id, mutation_prefix_key, stats_key, granted_stats_json, quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(base_item_id, mutation_prefix_key, stats_key)
       DO UPDATE SET
         quantity = equipment_inventory_stacks.quantity + excluded.quantity,
         updated_at = CURRENT_TIMESTAMP`,
      [baseItemId, mutationPrefixId, mutationPrefixKey, statsKey, grantedStatsJson, quantity]
    );
  },

  async consumeQuantity(
    baseItemId: string,
    mutationPrefixId: string | null,
    quantity: number,
    grantedStats?: EquipmentGrantRecord["grantedStats"]
  ): Promise<boolean> {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("consumeQuantity requires a positive quantity");
    }
    const db = await getDb();
    const current = await this.getStack(baseItemId, mutationPrefixId, grantedStats);
    if (!current || current.quantity < quantity) return false;
    const nextQuantity = current.quantity - quantity;
    if (nextQuantity <= 0) {
      const mutationPrefixKey = toMutationPrefixKey(mutationPrefixId);
      const statsKey = toEquipmentStatsKey(grantedStats);
      await db.runAsync(
        `DELETE FROM equipment_inventory_stacks
         WHERE base_item_id = ? AND mutation_prefix_key = ? AND stats_key = ?`,
        [baseItemId, mutationPrefixKey, statsKey]
      );
      return true;
    }
    await db.runAsync(
      `UPDATE equipment_inventory_stacks
       SET quantity = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextQuantity, current.id]
    );
    return true;
  },

  async applyGrantIfAbsent(input: { grant: EquipmentGrantRecord }): Promise<{ applied: boolean }> {
    const { grant } = input;
    if (!grant.grantKey) throw new Error("grantKey is required");
    if (!Number.isFinite(grant.quantity) || grant.quantity <= 0) {
      throw new Error("grant.quantity must be > 0");
    }

    const db = await getDb();
    const mutationPrefixKey = toMutationPrefixKey(grant.mutationPrefixId);
    const statsKey = toEquipmentStatsKey(grant.grantedStats);
    const grantedStatsJson = statsKey ? JSON.stringify(grant.grantedStats) : null;
    await db.execAsync("BEGIN;");
    try {
      await db.runAsync(
        `INSERT INTO equipment_grants
          (grant_key, source_type, base_item_id, mutation_prefix_id, granted_stats_json, quantity, context_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [
          grant.grantKey,
          grant.sourceType,
          grant.baseItemId,
          grant.mutationPrefixId,
          grantedStatsJson,
          grant.quantity,
          grant.contextJson,
          grant.createdAt ?? null,
        ]
      );

      await db.runAsync(
        `INSERT INTO equipment_inventory_stacks
          (base_item_id, mutation_prefix_id, mutation_prefix_key, stats_key, granted_stats_json, quantity, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(base_item_id, mutation_prefix_key, stats_key)
         DO UPDATE SET
           quantity = equipment_inventory_stacks.quantity + excluded.quantity,
           updated_at = CURRENT_TIMESTAMP`,
        [grant.baseItemId, grant.mutationPrefixId, mutationPrefixKey, statsKey, grantedStatsJson, grant.quantity]
      );

      await db.execAsync("COMMIT;");
      return { applied: true };
    } catch (error) {
      try {
        await db.execAsync("ROLLBACK;");
      } catch {
        // ignore rollback failure
      }
      if (isUniqueGrantConstraintError(error)) {
        return { applied: false };
      }
      throw error;
    }
  },
};
