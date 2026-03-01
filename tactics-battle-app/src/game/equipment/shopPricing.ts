import type { EquipmentMasterItem } from "@/types/equipment";
import { normalizeEquipmentStats } from "@/game/equipment/equipmentStatsService";

export const MIN_SHOP_PRICE_GOLD = 200;

const PRICE_WEIGHT = {
  hp: 18,
  atk: 120,
  def: 120,
  spi: 80,
  mp: 30,
  spd: 95,
  hpRegen: 260,
  mpRegen: 260,
} as const;

const BASE_PRICE_GOLD = 220;

export const calculateShopPriceGold = (item: EquipmentMasterItem): number => {
  const stats = normalizeEquipmentStats(item.stats);
  const raw =
    BASE_PRICE_GOLD +
    stats.hp * PRICE_WEIGHT.hp +
    stats.atk * PRICE_WEIGHT.atk +
    stats.def * PRICE_WEIGHT.def +
    stats.spi * PRICE_WEIGHT.spi +
    stats.mp * PRICE_WEIGHT.mp +
    stats.spd * PRICE_WEIGHT.spd +
    stats.hpRegen * PRICE_WEIGHT.hpRegen +
    stats.mpRegen * PRICE_WEIGHT.mpRegen;
  return Math.max(MIN_SHOP_PRICE_GOLD, Math.round(raw / 10) * 10);
};
