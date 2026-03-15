import enemiesData from "@/data/enemies.json";
import { DUNGEON_BOSS_BY_FLOOR } from "@/data/dungeonBosses";
import dungeonEnemyTableData from "@/data/dungeonEnemyTable.json";
import { Stats } from "@/game/battle";
import { createSeededRng } from "@/utils/rng";

export type EnemyMaster = {
  id: string;
  name: string;
  stats: Stats;
};

export type EncounterEnemy = {
  enemyId: string;
  name: string;
  stats: Stats;
  level?: number;
};

export type EncounterKind = "NORMAL" | "BOSS";

export type EncounterResult = {
  enemies: EncounterEnemy[];
  rollMeta: {
    dungeonId: string;
    floor: number;
    seed: number;
    enemyCount: number;
    encounterKind?: EncounterKind;
    bossName?: string;
  };
};

export type GenerateEncounterParams = {
  dungeonId: string;
  floor: number;
  seed: number;
  scaleOverrides?: EncounterScaleOverrides;
};

export type CreateBossEncounterParams = {
  dungeonId: string;
  floor: number;
  seed: number;
  scaleOverrides?: EncounterScaleOverrides;
};

export type EncounterScaleOverrides = {
  statScaleMultiplier?: number;
  statScaleAdd?: number;
  statScalePerFloorAdd?: number;
  hpScaleMultiplier?: number;
  hpScaleAdd?: number;
  hpScalePerFloorAdd?: number;
};

type FloorTable = {
  floor: number;
  tableId?: string;
  isBossFloor?: boolean;
  encounters: Array<{
    enemyId: string;
    weight: number;
    statScale?: number;
    hpScale?: number;
    level?: number;
  }>;
};

type DungeonTable = {
  dungeonId: string;
  floors: FloorTable[];
};

const ENEMY_MASTER = new Map(
  (enemiesData.enemies as EnemyMaster[]).map((enemy) => [enemy.id, enemy] as const)
);

const DUNGEON_TABLE = dungeonEnemyTableData.dungeons as DungeonTable[];

type WeightedEncounterEntry = {
  enemyId: string;
  weight: number;
  statScale?: number;
  hpScale?: number;
  level?: number;
};

const EXTRA_ENCOUNTERS_BY_TABLE: Partial<Record<string, WeightedEncounterEntry[]>> = {
  T01: [{ enemyId: "wolf", weight: 12, level: 1, statScale: 1, hpScale: 2 }],
  T06: [
    { enemyId: "ghoul", weight: 12 },
    { enemyId: "scorpion", weight: 10 },
  ],
  T07: [
    { enemyId: "lizardman", weight: 15 },
    { enemyId: "giant_bat", weight: 12 },
    { enemyId: "rock_lizard", weight: 12 },
  ],
  T08: [
    { enemyId: "lizardman", weight: 15, statScale: 1.204 },
    { enemyId: "wraith", weight: 12 },
  ],
  T09: [
    { enemyId: "lizardman", weight: 16 },
    { enemyId: "ghoul", weight: 10 },
    { enemyId: "scorpion", weight: 10 },
  ],
  T10: [
    { enemyId: "banshee", weight: 12 },
    { enemyId: "death_knight", weight: 10 },
  ],
  T12: [{ enemyId: "minotaur", weight: 18 }],
  T13: [
    { enemyId: "minotaur", weight: 18 },
    { enemyId: "storm_harpy", weight: 12 },
  ],
  T14: [{ enemyId: "champion_minotaur", weight: 16 }],
  T15: [
    { enemyId: "cyclops", weight: 18 },
    { enemyId: "golem", weight: 16 },
    { enemyId: "vampire", weight: 14 },
  ],
  T16: [
    { enemyId: "elder_cyclops", weight: 14 },
    { enemyId: "cyclops", weight: 14, statScale: 1.185 },
    { enemyId: "vampire", weight: 12, statScale: 1.185 },
    { enemyId: "shield_golem", weight: 12 },
  ],
};

const normalizeScale = (value: number | undefined): number => {
  if (value === undefined) return 1;
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value;
};

const DEF_DAMPENING = 0.3;
const SPD_DAMPENING = 0.2;

const resolveScaleOverride = (params: {
  baseScale: number | undefined;
  floor: number;
  multiplier?: number;
  add?: number;
  perFloorAdd?: number;
}): number => {
  const base = normalizeScale(params.baseScale);
  const floorOffset = Math.max(0, params.floor - 1);
  const multiplier = normalizeScale(params.multiplier);
  const add = Number.isFinite(params.add) ? (params.add as number) : 0;
  const perFloorAdd = Number.isFinite(params.perFloorAdd) ? (params.perFloorAdd as number) : 0;
  return Math.max(0.1, base * multiplier + add + floorOffset * perFloorAdd);
};

const scaleStats = (
  stats: Stats,
  scales: { statScale?: number; hpScale?: number } = {}
): Stats => {
  const statScale = normalizeScale(scales.statScale);
  const hpScale = normalizeScale(scales.hpScale);
  const hasScaling = statScale !== 1 || hpScale !== 1;
  if (!hasScaling) return { ...stats };

  const defScale = 1 + (statScale - 1) * DEF_DAMPENING;
  const spdScale = 1 + (statScale - 1) * SPD_DAMPENING;

  return {
    maxHp: Math.max(1, Math.round(stats.maxHp * statScale * hpScale)),
    atk: Math.max(1, Math.round(stats.atk * statScale)),
    def: Math.max(0, Math.round(stats.def * defScale)),
    spi: Math.max(0, Math.round(stats.spi * statScale)),
    spd: Math.max(1, Math.round(stats.spd * spdScale)),
    maxMp: Math.max(0, Math.round(stats.maxMp * statScale)),
    mpRegen: stats.maxMp <= 0 ? 0 : Math.max(1, Math.round(stats.mpRegen * statScale)),
  };
};

const pickWeightedEnemy = (
  entries: WeightedEncounterEntry[],
  rng: () => number
): WeightedEncounterEntry => {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (totalWeight <= 0) {
    throw new Error("Encounter table has no positive weights.");
  }
  let roll = rng() * totalWeight;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) {
      return entry;
    }
  }
  return entries[entries.length - 1];
};

const getEffectiveEncounters = (floorTable: FloorTable): WeightedEncounterEntry[] => [
  ...floorTable.encounters,
  ...(floorTable.tableId ? EXTRA_ENCOUNTERS_BY_TABLE[floorTable.tableId] ?? [] : []),
];

export const listNormalEncounterEnemyIds = (): string[] => {
  const ids = new Set<string>();
  for (const dungeon of DUNGEON_TABLE) {
    for (const floorTable of dungeon.floors) {
      for (const entry of getEffectiveEncounters(floorTable)) {
        ids.add(entry.enemyId);
      }
    }
  }
  return [...ids];
};

export const generateEncounter = (params: GenerateEncounterParams): EncounterResult => {
  const floor = Math.max(1, params.floor);
  const rng = createSeededRng(params.seed);
  const dungeon = DUNGEON_TABLE.find((entry) => entry.dungeonId === params.dungeonId);
  if (!dungeon) {
    throw new Error(`Unknown dungeon id: ${params.dungeonId}`);
  }
  const floorTable = dungeon.floors.find((entry) => entry.floor === floor);
  if (!floorTable) {
    throw new Error(`No encounter table for ${params.dungeonId} floor ${floor}`);
  }

  const enemyCount = 1 + Math.floor(rng() * 3);
  const effectiveEncounters = getEffectiveEncounters(floorTable);
  const enemies: EncounterEnemy[] = [];
  for (let i = 0; i < enemyCount; i += 1) {
    const picked = pickWeightedEnemy(effectiveEncounters, rng);
    const enemyMaster = ENEMY_MASTER.get(picked.enemyId);
    if (!enemyMaster) {
      throw new Error(`Unknown enemy id in table: ${picked.enemyId}`);
    }
    enemies.push({
      enemyId: picked.enemyId,
      name: enemyMaster.name,
      stats: scaleStats(enemyMaster.stats, {
        statScale: resolveScaleOverride({
          baseScale: picked.statScale,
          floor,
          multiplier: params.scaleOverrides?.statScaleMultiplier,
          add: params.scaleOverrides?.statScaleAdd,
          perFloorAdd: params.scaleOverrides?.statScalePerFloorAdd,
        }),
        hpScale: resolveScaleOverride({
          baseScale: picked.hpScale,
          floor,
          multiplier: params.scaleOverrides?.hpScaleMultiplier,
          add: params.scaleOverrides?.hpScaleAdd,
          perFloorAdd: params.scaleOverrides?.hpScalePerFloorAdd,
        }),
      }),
      level: picked.level,
    });
  }

  return {
    enemies,
    rollMeta: {
      dungeonId: params.dungeonId,
      floor,
      seed: params.seed,
      enemyCount,
      encounterKind: "NORMAL",
    },
  };
};

export const createBossEncounter = (params: CreateBossEncounterParams): EncounterResult => {
  const floor = Math.max(1, params.floor);
  const boss = DUNGEON_BOSS_BY_FLOOR.get(floor);
  if (!boss) {
    throw new Error(`No boss definition for ${params.dungeonId} floor ${floor}`);
  }

  return {
    enemies: [
      {
        enemyId: boss.id,
        name: boss.name,
        stats: scaleStats(boss.stats, {
          statScale: resolveScaleOverride({
            baseScale: 1,
            floor,
            multiplier: params.scaleOverrides?.statScaleMultiplier,
            add: params.scaleOverrides?.statScaleAdd,
            perFloorAdd: params.scaleOverrides?.statScalePerFloorAdd,
          }),
          hpScale: resolveScaleOverride({
            baseScale: 1,
            floor,
            multiplier: params.scaleOverrides?.hpScaleMultiplier,
            add: params.scaleOverrides?.hpScaleAdd,
            perFloorAdd: params.scaleOverrides?.hpScalePerFloorAdd,
          }),
        }),
      },
    ],
    rollMeta: {
      dungeonId: params.dungeonId,
      floor,
      seed: params.seed,
      enemyCount: 1,
      encounterKind: "BOSS",
      bossName: boss.name,
    },
  };
};
