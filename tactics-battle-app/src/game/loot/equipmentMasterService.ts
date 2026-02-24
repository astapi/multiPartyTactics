import equipmentMasterData from "@/data/equipmentMaster.json";
import type {
  EquipmentMasterBundle,
  EquipmentMasterItem,
  EquipmentSource,
  MutationPrefix,
} from "@/types/equipment";

let cached: {
  raw: EquipmentMasterBundle;
  equipmentById: Map<string, EquipmentMasterItem>;
  prefixById: Map<string, MutationPrefix>;
  mutationApplicableSet: Set<string>;
} | null = null;

const assertUnique = (items: string[], label: string): void => {
  const seen = new Set<string>();
  for (const id of items) {
    if (seen.has(id)) {
      throw new Error(`Duplicate ${label} id: ${id}`);
    }
    seen.add(id);
  }
};

const validateMaster = (master: EquipmentMasterBundle): void => {
  assertUnique(master.equipment.map((item) => item.id), "equipment");
  assertUnique(master.mutation_prefixes.map((prefix) => prefix.id), "mutation prefix");

  const equipmentById = new Map(master.equipment.map((item) => [item.id, item] as const));
  const listedApplicable = new Set(master.mutation_applicable.item_ids);

  for (const itemId of master.mutation_applicable.item_ids) {
    const item = equipmentById.get(itemId);
    if (!item) {
      throw new Error(`mutation_applicable references unknown equipment id: ${itemId}`);
    }
    if (item.source !== "monster") {
      throw new Error(`mutation_applicable item must be source=monster: ${itemId}`);
    }
    if (!item.can_mutate) {
      throw new Error(`mutation_applicable item must have can_mutate=true: ${itemId}`);
    }
  }

  const shouldBeApplicable = master.equipment
    .filter((item) => item.source === "monster" && item.can_mutate)
    .map((item) => item.id);
  const shouldBeApplicableSet = new Set(shouldBeApplicable);

  for (const itemId of shouldBeApplicableSet) {
    if (!listedApplicable.has(itemId)) {
      throw new Error(`Missing mutation_applicable item id for mutable monster item: ${itemId}`);
    }
  }
  for (const itemId of listedApplicable) {
    if (!shouldBeApplicableSet.has(itemId)) {
      throw new Error(`Unexpected mutation_applicable item id: ${itemId}`);
    }
  }
};

const init = () => {
  if (cached) return cached;
  const raw = equipmentMasterData as EquipmentMasterBundle;
  validateMaster(raw);
  cached = {
    raw,
    equipmentById: new Map(raw.equipment.map((item) => [item.id, item] as const)),
    prefixById: new Map(raw.mutation_prefixes.map((prefix) => [prefix.id, prefix] as const)),
    mutationApplicableSet: new Set(raw.mutation_applicable.item_ids),
  };
  return cached;
};

export const getEquipmentMaster = (): EquipmentMasterBundle => init().raw;

export const getEquipmentById = (id: string): EquipmentMasterItem => {
  const item = init().equipmentById.get(id);
  if (!item) throw new Error(`Unknown equipment id: ${id}`);
  return item;
};

export const listEquipmentBySource = (source: EquipmentSource): EquipmentMasterItem[] =>
  init().raw.equipment.filter((item) => item.source === source);

export const isMutationApplicable = (itemId: string): boolean => init().mutationApplicableSet.has(itemId);

export const buildEquipmentDisplayName = (
  baseItemId: string,
  mutationPrefixId: string | null
): { jp: string; en: string } => {
  const item = getEquipmentById(baseItemId);
  if (!mutationPrefixId) {
    return { jp: item.jp, en: item.en };
  }
  const prefix = init().prefixById.get(mutationPrefixId);
  if (!prefix) {
    throw new Error(`Unknown mutation prefix id: ${mutationPrefixId}`);
  }
  return {
    jp: `${prefix.jp}${item.jp}`,
    en: `${prefix.en} ${item.en}`,
  };
};

export const listMutationPrefixes = (): MutationPrefix[] => [...init().raw.mutation_prefixes];
