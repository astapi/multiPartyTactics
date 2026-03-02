import consumableMasterData from "@/data/consumableMaster.json";
import type {
  ConsumableCategory,
  ConsumableMasterBundle,
  ConsumableMasterItem,
} from "@/types/consumable";

let cached: {
  raw: ConsumableMasterBundle;
  byId: Map<string, ConsumableMasterItem>;
} | null = null;

const validate = (master: ConsumableMasterBundle): void => {
  const ids = new Set<string>();
  for (const item of master.consumables) {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate consumable id: ${item.id}`);
    }
    ids.add(item.id);
    if (item.priceGold < 0) {
      throw new Error(`Invalid price for consumable: ${item.id}`);
    }
  }
};

const init = () => {
  if (cached) return cached;
  const raw = consumableMasterData as ConsumableMasterBundle;
  validate(raw);
  cached = {
    raw,
    byId: new Map(raw.consumables.map((c) => [c.id, c] as const)),
  };
  return cached;
};

export const getConsumableById = (id: string): ConsumableMasterItem => {
  const item = init().byId.get(id);
  if (!item) throw new Error(`Unknown consumable id: ${id}`);
  return item;
};

export const listConsumables = (): ConsumableMasterItem[] =>
  [...init().raw.consumables].sort((a, b) => a.sortOrder - b.sortOrder);

export const listConsumablesByCategory = (
  category: ConsumableCategory
): ConsumableMasterItem[] =>
  listConsumables().filter((c) => c.category === category);
