import { isClassId } from "@/constants/classes";
import { getDb } from "@/db/database";
import { canCharacterEquipItem, getEquipSlotForCategory } from "@/game/equipment/equipmentRules";
import { getEquipmentById } from "@/game/loot/equipmentMasterService";
import type {
  CharacterEquipmentRecord,
  EquipmentSlot,
} from "@/types/equipment";
import type { ClassId } from "@/types/models";

type EquipmentBySlot = Partial<Record<EquipmentSlot, CharacterEquipmentRecord>>;

type EquipInput = {
  characterId: string;
  slotType: EquipmentSlot;
  baseItemId: string;
  mutationPrefixId: string | null;
};

type UnequipInput = {
  characterId: string;
  slotType: EquipmentSlot;
};

const toMutationPrefixKey = (mutationPrefixId: string | null): string => mutationPrefixId ?? "";

const mapCharacterEquipment = (row: any): CharacterEquipmentRecord => ({
  characterId: row.character_id,
  slotType: row.slot_type,
  baseItemId: row.base_item_id,
  mutationPrefixId: row.mutation_prefix_id ?? null,
  equippedAt: row.equipped_at,
});

const assertSlotType = (value: unknown): EquipmentSlot => {
  if (value === "weapon" || value === "armor") return value;
  throw new Error(`Invalid equipment slot type: ${String(value)}`);
};

const getCharacterClassId = async (db: Awaited<ReturnType<typeof getDb>>, characterId: string): Promise<ClassId> => {
  const row = await db.getFirstAsync<{ class_id: string }>(
    "SELECT class_id FROM characters WHERE id = ? LIMIT 1",
    [characterId]
  );
  if (!row) {
    throw new Error(`Character not found: ${characterId}`);
  }
  if (!isClassId(row.class_id)) {
    throw new Error(`Invalid class id found in DB: ${row.class_id}`);
  }
  return row.class_id;
};

const getEquippedSlotRecordTx = async (
  db: Awaited<ReturnType<typeof getDb>>,
  characterId: string,
  slotType: EquipmentSlot
): Promise<CharacterEquipmentRecord | null> => {
  const row = await db.getFirstAsync<any>(
    `SELECT *
     FROM character_equipment_slots
     WHERE character_id = ? AND slot_type = ?
     LIMIT 1`,
    [characterId, slotType]
  );
  if (!row) return null;
  return {
    ...mapCharacterEquipment(row),
    slotType: assertSlotType(row.slot_type),
  };
};

const addStackQuantityTx = async (
  db: Awaited<ReturnType<typeof getDb>>,
  baseItemId: string,
  mutationPrefixId: string | null,
  quantity: number
): Promise<void> => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("addStackQuantityTx requires a positive quantity");
  }
  const mutationPrefixKey = toMutationPrefixKey(mutationPrefixId);
  await db.runAsync(
    `INSERT INTO equipment_inventory_stacks
      (base_item_id, mutation_prefix_id, mutation_prefix_key, quantity, created_at, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(base_item_id, mutation_prefix_key)
     DO UPDATE SET
       quantity = equipment_inventory_stacks.quantity + excluded.quantity,
       updated_at = CURRENT_TIMESTAMP`,
    [baseItemId, mutationPrefixId, mutationPrefixKey, quantity]
  );
};

const consumeStackQuantityTx = async (
  db: Awaited<ReturnType<typeof getDb>>,
  baseItemId: string,
  mutationPrefixId: string | null,
  quantity: number
): Promise<boolean> => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("consumeStackQuantityTx requires a positive quantity");
  }
  const mutationPrefixKey = toMutationPrefixKey(mutationPrefixId);
  const row = await db.getFirstAsync<any>(
    `SELECT *
     FROM equipment_inventory_stacks
     WHERE base_item_id = ? AND mutation_prefix_key = ?
     LIMIT 1`,
    [baseItemId, mutationPrefixKey]
  );
  if (!row || row.quantity < quantity) return false;

  const nextQuantity = row.quantity - quantity;
  if (nextQuantity <= 0) {
    await db.runAsync(
      `DELETE FROM equipment_inventory_stacks
       WHERE base_item_id = ? AND mutation_prefix_key = ?`,
      [baseItemId, mutationPrefixKey]
    );
    return true;
  }

  await db.runAsync(
    `UPDATE equipment_inventory_stacks
     SET quantity = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nextQuantity, row.id]
  );
  return true;
};

export const characterEquipmentRepository = {
  async getByCharacterId(characterId: string): Promise<EquipmentBySlot> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT *
       FROM character_equipment_slots
       WHERE character_id = ?`,
      [characterId]
    );
    const out: EquipmentBySlot = {};
    for (const row of rows) {
      const slotType = assertSlotType(row.slot_type);
      out[slotType] = {
        ...mapCharacterEquipment(row),
        slotType,
      };
    }
    return out;
  },

  async equip(input: EquipInput): Promise<void> {
    const item = getEquipmentById(input.baseItemId);
    const derivedSlot = getEquipSlotForCategory(item.category);
    if (!derivedSlot) {
      throw new Error(`Unsupported equipment category for equipping: ${item.category}`);
    }
    if (derivedSlot !== input.slotType) {
      throw new Error(`Item category ${item.category} cannot be equipped to ${input.slotType} slot`);
    }

    const db = await getDb();
    const classId = await getCharacterClassId(db, input.characterId);
    if (!canCharacterEquipItem(classId, item)) {
      throw new Error(`${classId} cannot equip ${item.id}`);
    }

    await db.execAsync("BEGIN;");
    try {
      const current = await getEquippedSlotRecordTx(db, input.characterId, input.slotType);
      if (
        current &&
        current.baseItemId === input.baseItemId &&
        current.mutationPrefixId === input.mutationPrefixId
      ) {
        await db.execAsync("COMMIT;");
        return;
      }

      const consumed = await consumeStackQuantityTx(
        db,
        input.baseItemId,
        input.mutationPrefixId,
        1
      );
      if (!consumed) {
        throw new Error("装備対象が所持品にありません");
      }

      if (current) {
        await addStackQuantityTx(db, current.baseItemId, current.mutationPrefixId, 1);
      }

      await db.runAsync(
        `INSERT INTO character_equipment_slots
          (character_id, slot_type, base_item_id, mutation_prefix_id, equipped_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(character_id, slot_type)
         DO UPDATE SET
           base_item_id = excluded.base_item_id,
           mutation_prefix_id = excluded.mutation_prefix_id,
           equipped_at = CURRENT_TIMESTAMP`,
        [input.characterId, input.slotType, input.baseItemId, input.mutationPrefixId]
      );

      await db.execAsync("COMMIT;");
    } catch (error) {
      try {
        await db.execAsync("ROLLBACK;");
      } catch {
        // ignore rollback failure
      }
      throw error;
    }
  },

  async unequip(input: UnequipInput): Promise<void> {
    const db = await getDb();
    await getCharacterClassId(db, input.characterId);

    await db.execAsync("BEGIN;");
    try {
      const current = await getEquippedSlotRecordTx(db, input.characterId, input.slotType);
      if (!current) {
        await db.execAsync("COMMIT;");
        return;
      }

      await db.runAsync(
        `DELETE FROM character_equipment_slots
         WHERE character_id = ? AND slot_type = ?`,
        [input.characterId, input.slotType]
      );
      await addStackQuantityTx(db, current.baseItemId, current.mutationPrefixId, 1);
      await db.execAsync("COMMIT;");
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

