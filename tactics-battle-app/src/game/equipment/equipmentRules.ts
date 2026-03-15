import type { ClassId } from "@/types/models";
import type {
  EquipmentCategory,
  EquipmentMasterItem,
  EquipmentSlot,
} from "@/types/equipment";

const WEAPON_CATEGORIES = new Set<EquipmentCategory>([
  "one_handed_sword",
  "dagger",
  "throwing_knife",
  "two_handed_axe",
  "two_handed_hammer",
  "bow",
  "staff",
]);

export const getEquipSlotForCategory = (
  category: EquipmentCategory
): EquipmentSlot | null => {
  if (WEAPON_CATEGORIES.has(category)) return "weapon";
  if (category === "shield") return "armor";
  return null;
};

export const canCharacterEquipItem = (
  classId: ClassId,
  item: EquipmentMasterItem
): boolean => {
  switch (classId) {
    case "GUARDIAN":
      return item.category === "shield" && item.shieldSize === "large";
    case "SWORDMAN":
      if (item.category === "one_handed_sword") return true;
      return item.category === "shield" && item.shieldSize === "small";
    case "BERSERKER":
      return item.category === "two_handed_axe";
    case "CLERIC":
    case "WITCH":
      return item.category === "staff";
    case "THIEF":
      return item.category === "dagger" || item.category === "throwing_knife";
    case "PORTER":
      return item.category === "one_handed_sword" || item.category === "shield";
    default:
      return false;
  }
};
