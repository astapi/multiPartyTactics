import { describe, expect, it } from "vitest";
import {
  buildEquipmentDisplayName,
  getEquipmentMaster,
  isMutationApplicable,
  listEquipmentBySource,
} from "@/game/loot/equipmentMasterService";

describe("game/loot/equipmentMasterService", () => {
  it("validates master consistency and exposes expected mutation set", () => {
    const master = getEquipmentMaster();
    const ids = new Set(master.equipment.map((item) => item.id));
    expect(ids.size).toBe(master.equipment.length);

    for (const itemId of master.mutation_applicable.item_ids) {
      const item = master.equipment.find((entry) => entry.id === itemId);
      expect(item).toBeTruthy();
      expect(item?.source).toBe("monster");
      expect(item?.can_mutate).toBe(true);
      expect(isMutationApplicable(itemId)).toBe(true);
    }

    const mutableMonsterIds = new Set(
      master.equipment.filter((item) => item.source === "monster" && item.can_mutate).map((item) => item.id)
    );
    expect(new Set(master.mutation_applicable.item_ids)).toEqual(mutableMonsterIds);
  });

  it("builds localized display names with and without mutation prefixes", () => {
    expect(buildEquipmentDisplayName("dragon_fang_sword", null)).toEqual({
      jp: "竜牙剣",
      en: "Dragonfang Sword",
    });
    expect(buildEquipmentDisplayName("dragon_fang_sword", "twin")).toEqual({
      jp: "双竜牙剣",
      en: "Twin Dragonfang Sword",
    });
  });

  it("lists chest and monster equipment separately", () => {
    const chest = listEquipmentBySource("chest");
    const monster = listEquipmentBySource("monster");
    expect(chest.length).toBeGreaterThan(0);
    expect(monster.length).toBeGreaterThan(0);
    expect(chest.every((item) => item.source === "chest")).toBe(true);
    expect(monster.every((item) => item.source === "monster")).toBe(true);
  });
});
