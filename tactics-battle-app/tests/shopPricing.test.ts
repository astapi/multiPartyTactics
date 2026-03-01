import { describe, expect, it } from "vitest";
import { calculateShopPriceGold, MIN_SHOP_PRICE_GOLD } from "@/game/equipment/shopPricing";
import { getEquipmentById } from "@/game/loot/equipmentMasterService";

describe("game/equipment/shopPricing", () => {
  it("is deterministic for the same item", () => {
    const item = getEquipmentById("bronze_sword");
    const a = calculateShopPriceGold(item);
    const b = calculateShopPriceGold(item);
    expect(a).toBe(b);
  });

  it("guarantees minimum price", () => {
    const price = calculateShopPriceGold({
      id: "dummy",
      category: "one_handed_sword",
      source: "shop",
      jp: "dummy",
      en: "dummy",
      can_mutate: false,
      stats: {},
    });
    expect(price).toBeGreaterThanOrEqual(MIN_SHOP_PRICE_GOLD);
  });

  it("prices stronger stats higher", () => {
    const dagger = calculateShopPriceGold(getEquipmentById("bronze_dagger"));
    const axe = calculateShopPriceGold(getEquipmentById("bronze_great_axe"));
    expect(axe).toBeGreaterThan(dagger);
  });
});
