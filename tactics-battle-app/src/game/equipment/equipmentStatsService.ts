import type { Stats } from "@/game/battle";
import { getEquipmentById } from "@/game/loot/equipmentMasterService";
import type {
  CharacterEquipmentRecord,
  EquipmentSlot,
  EquipmentStats,
  ResolvedEquipmentStats,
} from "@/types/equipment";
import type { CharacterRecord } from "@/types/models";

const EMPTY_STATS: ResolvedEquipmentStats = {
  hp: 0,
  atk: 0,
  def: 0,
  spi: 0,
  mp: 0,
  spd: 0,
  hpRegen: 0,
  mpRegen: 0,
};

const STAT_ORDER: Array<keyof ResolvedEquipmentStats> = [
  "hp",
  "atk",
  "def",
  "spi",
  "mp",
  "spd",
  "hpRegen",
  "mpRegen",
];

const clampInt = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.floor(value)));

export const normalizeEquipmentStats = (stats?: EquipmentStats): ResolvedEquipmentStats => ({
  hp: Math.floor(stats?.hp ?? 0),
  atk: Math.floor(stats?.atk ?? 0),
  def: Math.floor(stats?.def ?? 0),
  spi: Math.floor(stats?.spi ?? 0),
  mp: Math.floor(stats?.mp ?? 0),
  spd: Math.floor(stats?.spd ?? 0),
  hpRegen: Math.floor(stats?.hpRegen ?? 0),
  mpRegen: Math.floor(stats?.mpRegen ?? 0),
});

export const sumEquipmentStats = (list: Array<EquipmentStats | undefined>): ResolvedEquipmentStats => {
  const out = { ...EMPTY_STATS };
  for (const raw of list) {
    const next = normalizeEquipmentStats(raw);
    for (const key of STAT_ORDER) {
      out[key] += next[key];
    }
  }
  return out;
};

export const getEquipmentStatsByItem = (
  baseItemId: string,
  _mutationPrefixId: string | null
): ResolvedEquipmentStats => {
  const item = getEquipmentById(baseItemId);
  return normalizeEquipmentStats(item.stats);
};

type CharacterDerivedStatBundle = {
  base: ResolvedEquipmentStats;
  bonus: ResolvedEquipmentStats;
  total: ResolvedEquipmentStats;
  battle: Stats;
};

export const computeCharacterDerivedStats = (
  character: CharacterRecord,
  equippedBySlot: Partial<Record<EquipmentSlot, CharacterEquipmentRecord>>
): CharacterDerivedStatBundle => {
  const base: ResolvedEquipmentStats = {
    hp: character.baseMaxHp,
    atk: character.baseAtk,
    def: character.baseDef,
    spi: character.baseSpi ?? 0,
    mp: character.baseMaxMp,
    spd: character.baseSpd,
    hpRegen: 0,
    mpRegen: character.baseMpRegen,
  };
  const bonus = sumEquipmentStats(
    (["weapon", "armor"] as const)
      .map((slot) => equippedBySlot[slot])
      .filter((entry): entry is CharacterEquipmentRecord => Boolean(entry))
      .map((entry) => getEquipmentStatsByItem(entry.baseItemId, entry.mutationPrefixId))
  );
  const total: ResolvedEquipmentStats = {
    hp: base.hp + bonus.hp,
    atk: base.atk + bonus.atk,
    def: base.def + bonus.def,
    spi: base.spi + bonus.spi,
    mp: base.mp + bonus.mp,
    spd: base.spd + bonus.spd,
    hpRegen: base.hpRegen + bonus.hpRegen,
    mpRegen: base.mpRegen + bonus.mpRegen,
  };
  const battle: Stats = {
    maxHp: Math.max(1, total.hp),
    atk: Math.max(1, total.atk),
    def: Math.max(0, total.def),
    spi: Math.max(0, total.spi),
    spd: Math.max(1, total.spd),
    maxMp: Math.max(0, total.mp),
    mpRegen: Math.max(0, total.mpRegen),
  };
  return { base, bonus, total, battle };
};

export const toBattleResource = (baseCurrent: number, baseMax: number, maxBonus: number): number => {
  const battleMax = Math.max(0, Math.floor(baseMax + maxBonus));
  return clampInt(Math.floor(baseCurrent + maxBonus), 0, battleMax);
};

export const toBaseResource = (battleCurrent: number, baseMax: number, maxBonus: number): number =>
  clampInt(Math.floor(battleCurrent - maxBonus), 0, Math.max(0, Math.floor(baseMax)));

export const formatStatLines = (
  stats: EquipmentStats | ResolvedEquipmentStats | undefined,
  locale: "ja" | "en"
): string[] => {
  const resolved = normalizeEquipmentStats(stats);
  const labelsJa: Record<keyof ResolvedEquipmentStats, string> = {
    hp: "HP",
    atk: "ATK",
    def: "DEF",
    spi: "SPI",
    mp: "MP",
    spd: "SPD",
    hpRegen: "HP回復",
    mpRegen: "MP回復",
  };
  const labelsEn: Record<keyof ResolvedEquipmentStats, string> = {
    hp: "HP",
    atk: "ATK",
    def: "DEF",
    spi: "SPI",
    mp: "MP",
    spd: "SPD",
    hpRegen: "HP Regen",
    mpRegen: "MP Regen",
  };
  const labels = locale === "ja" ? labelsJa : labelsEn;
  const lines: string[] = [];
  for (const key of STAT_ORDER) {
    const value = resolved[key];
    if (value === 0) continue;
    const sign = value > 0 ? "+" : "";
    lines.push(`${sign}${value} ${labels[key]}`);
  }
  return lines;
};

export const formatStatSummary = (
  stats: EquipmentStats | ResolvedEquipmentStats | undefined,
  locale: "ja" | "en"
): string => formatStatLines(stats, locale).join(" / ");
