import enemiesData from "@/data/enemies.json";
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
};

export type EncounterResult = {
  enemies: EncounterEnemy[];
  rollMeta: {
    dungeonId: string;
    floor: number;
    seed: number;
    enemyCount: number;
  };
};

export type GenerateEncounterParams = {
  dungeonId: string;
  floor: number;
  seed: number;
};

type FloorTable = {
  floor: number;
  encounters: Array<{
    enemyId: string;
    weight: number;
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

const pickWeightedEnemyId = (
  entries: Array<{ enemyId: string; weight: number }>,
  rng: () => number
): string => {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (totalWeight <= 0) {
    throw new Error("Encounter table has no positive weights.");
  }
  let roll = rng() * totalWeight;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) {
      return entry.enemyId;
    }
  }
  return entries[entries.length - 1].enemyId;
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
  const enemies: EncounterEnemy[] = [];
  for (let i = 0; i < enemyCount; i += 1) {
    const enemyId = pickWeightedEnemyId(floorTable.encounters, rng);
    const enemyMaster = ENEMY_MASTER.get(enemyId);
    if (!enemyMaster) {
      throw new Error(`Unknown enemy id in table: ${enemyId}`);
    }
    enemies.push({
      enemyId,
      name: enemyMaster.name,
      stats: { ...enemyMaster.stats },
    });
  }

  return {
    enemies,
    rollMeta: {
      dungeonId: params.dungeonId,
      floor,
      seed: params.seed,
      enemyCount,
    },
  };
};
