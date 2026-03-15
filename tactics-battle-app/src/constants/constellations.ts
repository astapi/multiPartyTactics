export type ConstellationGrowthBonus = {
  maxHp: number;
  atk: number;
  def: number;
  spi: number;
  spd: number;
  maxMp: number;
  mpRegen: number;
};

export type ConstellationInfo = {
  id: ConstellationId;
  category: "ZODIAC" | "SAINT";
  nameJa: string;
  nameEn: string;
  growthBonus: ConstellationGrowthBonus;
};

export const ZODIAC_CONSTELLATION_IDS = [
  "ARIES",
  "TAURUS",
  "GEMINI",
  "CANCER",
  "LEO",
  "VIRGO",
  "LIBRA",
  "SCORPIO",
  "SAGITTARIUS",
  "CAPRICORN",
  "AQUARIUS",
  "PISCES",
] as const;

export const EXTRA_CONSTELLATION_IDS = [
  "PEGASUS",
  "DRAGON",
  "CYGNUS",
  "ANDROMEDA",
  "PHOENIX",
  "UNICORN",
  "HYDRA",
  "WOLF",
  "LIONET",
  "BEAR",
  "CHAMELEON",
  "CRANE",
] as const;

export type ConstellationId =
  | (typeof ZODIAC_CONSTELLATION_IDS)[number]
  | (typeof EXTRA_CONSTELLATION_IDS)[number];

export const DEFAULT_CONSTELLATION_ID: ConstellationId = "ARIES";

export const CONSTELLATION_MASTER: ConstellationInfo[] = [
  { id: "ARIES", category: "ZODIAC", nameJa: "牡羊座", nameEn: "Aries", growthBonus: { maxHp: 0.5, atk: 0.18, def: 0.04, spi: 0.08, spd: 0.08, maxMp: 0.06, mpRegen: 0.001 } },
  { id: "TAURUS", category: "ZODIAC", nameJa: "牡牛座", nameEn: "Taurus", growthBonus: { maxHp: 0.85, atk: 0.08, def: 0.18, spi: 0.03, spd: 0.02, maxMp: 0.03, mpRegen: 0.0 } },
  { id: "GEMINI", category: "ZODIAC", nameJa: "双子座", nameEn: "Gemini", growthBonus: { maxHp: 0.25, atk: 0.12, def: 0.04, spi: 0.18, spd: 0.14, maxMp: 0.18, mpRegen: 0.002 } },
  { id: "CANCER", category: "ZODIAC", nameJa: "蟹座", nameEn: "Cancer", growthBonus: { maxHp: 0.55, atk: 0.08, def: 0.12, spi: 0.08, spd: 0.04, maxMp: 0.08, mpRegen: 0.001 } },
  { id: "LEO", category: "ZODIAC", nameJa: "獅子座", nameEn: "Leo", growthBonus: { maxHp: 0.45, atk: 0.22, def: 0.06, spi: 0.06, spd: 0.06, maxMp: 0.04, mpRegen: 0.001 } },
  { id: "VIRGO", category: "ZODIAC", nameJa: "乙女座", nameEn: "Virgo", growthBonus: { maxHp: 0.2, atk: 0.05, def: 0.08, spi: 0.28, spd: 0.08, maxMp: 0.28, mpRegen: 0.003 } },
  { id: "LIBRA", category: "ZODIAC", nameJa: "天秤座", nameEn: "Libra", growthBonus: { maxHp: 0.35, atk: 0.12, def: 0.12, spi: 0.08, spd: 0.08, maxMp: 0.08, mpRegen: 0.001 } },
  { id: "SCORPIO", category: "ZODIAC", nameJa: "蠍座", nameEn: "Scorpio", growthBonus: { maxHp: 0.25, atk: 0.18, def: 0.04, spi: 0.06, spd: 0.16, maxMp: 0.06, mpRegen: 0.001 } },
  { id: "SAGITTARIUS", category: "ZODIAC", nameJa: "射手座", nameEn: "Sagittarius", growthBonus: { maxHp: 0.3, atk: 0.16, def: 0.04, spi: 0.1, spd: 0.14, maxMp: 0.1, mpRegen: 0.001 } },
  { id: "CAPRICORN", category: "ZODIAC", nameJa: "山羊座", nameEn: "Capricorn", growthBonus: { maxHp: 0.45, atk: 0.14, def: 0.16, spi: 0.04, spd: 0.04, maxMp: 0.04, mpRegen: 0.0 } },
  { id: "AQUARIUS", category: "ZODIAC", nameJa: "水瓶座", nameEn: "Aquarius", growthBonus: { maxHp: 0.25, atk: 0.08, def: 0.04, spi: 0.24, spd: 0.1, maxMp: 0.24, mpRegen: 0.003 } },
  { id: "PISCES", category: "ZODIAC", nameJa: "魚座", nameEn: "Pisces", growthBonus: { maxHp: 0.25, atk: 0.1, def: 0.05, spi: 0.2, spd: 0.08, maxMp: 0.2, mpRegen: 0.003 } },
  { id: "PEGASUS", category: "SAINT", nameJa: "天馬座", nameEn: "Pegasus", growthBonus: { maxHp: 0.4, atk: 0.14, def: 0.04, spi: 0.05, spd: 0.18, maxMp: 0.05, mpRegen: 0.001 } },
  { id: "DRAGON", category: "SAINT", nameJa: "龍座", nameEn: "Dragon", growthBonus: { maxHp: 0.6, atk: 0.12, def: 0.2, spi: 0.04, spd: 0.03, maxMp: 0.04, mpRegen: 0.0 } },
  { id: "CYGNUS", category: "SAINT", nameJa: "白鳥座（キグナス）", nameEn: "Cygnus", growthBonus: { maxHp: 0.25, atk: 0.08, def: 0.08, spi: 0.2, spd: 0.1, maxMp: 0.2, mpRegen: 0.003 } },
  { id: "ANDROMEDA", category: "SAINT", nameJa: "アンドロメダ座", nameEn: "Andromeda", growthBonus: { maxHp: 0.35, atk: 0.08, def: 0.14, spi: 0.14, spd: 0.08, maxMp: 0.14, mpRegen: 0.002 } },
  { id: "PHOENIX", category: "SAINT", nameJa: "鳳凰座", nameEn: "Phoenix", growthBonus: { maxHp: 0.45, atk: 0.2, def: 0.06, spi: 0.08, spd: 0.08, maxMp: 0.08, mpRegen: 0.002 } },
  { id: "UNICORN", category: "SAINT", nameJa: "一角獣座", nameEn: "Unicorn", growthBonus: { maxHp: 0.4, atk: 0.12, def: 0.08, spi: 0.08, spd: 0.1, maxMp: 0.08, mpRegen: 0.001 } },
  { id: "HYDRA", category: "SAINT", nameJa: "海ヘビ座", nameEn: "Hydra", growthBonus: { maxHp: 0.5, atk: 0.1, def: 0.12, spi: 0.08, spd: 0.06, maxMp: 0.08, mpRegen: 0.001 } },
  { id: "WOLF", category: "SAINT", nameJa: "狼座", nameEn: "Wolf", growthBonus: { maxHp: 0.35, atk: 0.14, def: 0.08, spi: 0.05, spd: 0.12, maxMp: 0.05, mpRegen: 0.001 } },
  { id: "LIONET", category: "SAINT", nameJa: "子獅子座", nameEn: "Lionet", growthBonus: { maxHp: 0.3, atk: 0.16, def: 0.06, spi: 0.08, spd: 0.12, maxMp: 0.08, mpRegen: 0.001 } },
  { id: "BEAR", category: "SAINT", nameJa: "大熊座", nameEn: "Bear", growthBonus: { maxHp: 0.75, atk: 0.08, def: 0.18, spi: 0.03, spd: 0.02, maxMp: 0.03, mpRegen: 0.0 } },
  { id: "CHAMELEON", category: "SAINT", nameJa: "カメレオン座", nameEn: "Chameleon", growthBonus: { maxHp: 0.2, atk: 0.08, def: 0.06, spi: 0.12, spd: 0.18, maxMp: 0.12, mpRegen: 0.002 } },
  { id: "CRANE", category: "SAINT", nameJa: "鶴座", nameEn: "Crane", growthBonus: { maxHp: 0.25, atk: 0.06, def: 0.08, spi: 0.18, spd: 0.12, maxMp: 0.18, mpRegen: 0.003 } },
];

const CONSTELLATION_BY_ID: Record<ConstellationId, ConstellationInfo> = Object.fromEntries(
  CONSTELLATION_MASTER.map((constellation) => [constellation.id, constellation])
) as Record<ConstellationId, ConstellationInfo>;

export const isConstellationId = (value: string): value is ConstellationId => {
  return value in CONSTELLATION_BY_ID;
};

export const getConstellationById = (id: ConstellationId): ConstellationInfo => {
  return CONSTELLATION_BY_ID[id];
};

export const getConstellationGrowthBonus = (id: ConstellationId | null | undefined): ConstellationGrowthBonus => {
  if (!id) return CONSTELLATION_BY_ID[DEFAULT_CONSTELLATION_ID].growthBonus;
  return (CONSTELLATION_BY_ID[id] ?? CONSTELLATION_BY_ID[DEFAULT_CONSTELLATION_ID]).growthBonus;
};

export const getRandomConstellationId = (rng: () => number = Math.random): ConstellationId => {
  const index = Math.floor(Math.max(0, Math.min(0.999999, rng())) * CONSTELLATION_MASTER.length);
  return CONSTELLATION_MASTER[index]?.id ?? DEFAULT_CONSTELLATION_ID;
};

export const getConstellationDisplayName = (
  id: ConstellationId | null | undefined,
  locale: "ja" | "en" = "ja"
): string => {
  const info = getConstellationById(id && isConstellationId(id) ? id : DEFAULT_CONSTELLATION_ID);
  return locale === "ja" ? info.nameJa : info.nameEn;
};
