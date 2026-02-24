import { describe, expect, it } from "vitest";
import { canCharacterEquipItem, getEquipSlotForCategory } from "@/game/equipment/equipmentRules";
import { getEquipmentById } from "@/game/loot/equipmentMasterService";

describe("game/equipment/equipmentRules", () => {
  it("maps equipment categories to slots", () => {
    expect(getEquipSlotForCategory("one_handed_sword")).toBe("weapon");
    expect(getEquipSlotForCategory("staff")).toBe("weapon");
    expect(getEquipSlotForCategory("shield")).toBe("armor");
  });

  it("enforces class weapon and armor restrictions", () => {
    expect(canCharacterEquipItem("GUARDIAN", getEquipmentById("iron_shield"))).toBe(true);
    expect(canCharacterEquipItem("GUARDIAN", getEquipmentById("iron_sword"))).toBe(false);

    expect(canCharacterEquipItem("SWORDMAN", getEquipmentById("iron_sword"))).toBe(true);
    expect(canCharacterEquipItem("SWORDMAN", getEquipmentById("iron_shield"))).toBe(false);

    expect(canCharacterEquipItem("BERSERKER", getEquipmentById("iron_great_axe"))).toBe(true);
    expect(canCharacterEquipItem("BERSERKER", getEquipmentById("iron_hammer"))).toBe(false);
    expect(canCharacterEquipItem("BERSERKER", getEquipmentById("iron_shield"))).toBe(false);

    expect(canCharacterEquipItem("CLERIC", getEquipmentById("wood_staff"))).toBe(true);
    expect(canCharacterEquipItem("WITCH", getEquipmentById("wood_staff"))).toBe(true);
    expect(canCharacterEquipItem("CLERIC", getEquipmentById("iron_sword"))).toBe(false);

    expect(canCharacterEquipItem("THIEF", getEquipmentById("iron_dagger"))).toBe(true);
    expect(canCharacterEquipItem("THIEF", getEquipmentById("fang_throwing_knife"))).toBe(true);
    expect(canCharacterEquipItem("THIEF", getEquipmentById("iron_sword"))).toBe(false);
  });

  it("treats shield without size as not equipable for size-specific classes", () => {
    const shieldWithoutSize = {
      ...getEquipmentById("iron_shield"),
      shieldSize: undefined,
    };
    expect(canCharacterEquipItem("GUARDIAN", shieldWithoutSize)).toBe(false);
    expect(canCharacterEquipItem("SWORDMAN", shieldWithoutSize)).toBe(false);
  });
});
