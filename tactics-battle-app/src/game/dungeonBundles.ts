import dungeonEnemyTableData from "@/data/dungeonEnemyTable.json";

export type DungeonBundleRange = {
  startFloor: number;
  bossFloor: number;
};

type DungeonEnemyTableEntry = {
  dungeonId: string;
  bossFloors?: number[];
  floors: Array<{ floor: number }>;
};

const DUNGEON_TABLES = dungeonEnemyTableData.dungeons as DungeonEnemyTableEntry[];

const getDungeonTable = (dungeonId: string): DungeonEnemyTableEntry | null =>
  DUNGEON_TABLES.find((entry) => entry.dungeonId === dungeonId) ?? null;

export const getDungeonBossFloors = (dungeonId: string): number[] => {
  const table = getDungeonTable(dungeonId);
  if (!table) return [];
  return [...(table.bossFloors ?? [])].filter((floor) => Number.isFinite(floor)).sort((a, b) => a - b);
};

export const buildDungeonBundles = (dungeonId: string): DungeonBundleRange[] => {
  const table = getDungeonTable(dungeonId);
  if (!table) return [];
  const maxFloor = table.floors.reduce((max, floor) => Math.max(max, floor.floor), 1);
  const bossFloors = getDungeonBossFloors(dungeonId).filter((floor) => floor >= 1 && floor <= maxFloor);

  if (bossFloors.length === 0) {
    return table.floors
      .map((floor) => floor.floor)
      .sort((a, b) => a - b)
      .map((floor) => ({ startFloor: floor, bossFloor: floor }));
  }

  const bundles: DungeonBundleRange[] = [];
  let startFloor = 1;
  for (const bossFloor of bossFloors) {
    if (bossFloor < startFloor) continue;
    bundles.push({ startFloor, bossFloor });
    startFloor = bossFloor + 1;
  }
  if (startFloor <= maxFloor) {
    bundles.push({ startFloor, bossFloor: maxFloor });
  }
  return bundles;
};

export const findBundleByFloor = (dungeonId: string, floor: number): DungeonBundleRange => {
  const normalized = Math.max(1, Math.floor(floor));
  const bundles = buildDungeonBundles(dungeonId);
  if (bundles.length === 0) {
    return { startFloor: normalized, bossFloor: normalized };
  }
  return (
    bundles.find((bundle) => normalized >= bundle.startFloor && normalized <= bundle.bossFloor) ??
    bundles[bundles.length - 1]
  );
};

export const formatBundleLabel = (bundle: DungeonBundleRange): string =>
  bundle.startFloor === bundle.bossFloor ? `B${bundle.startFloor}` : `B${bundle.startFloor}-B${bundle.bossFloor}`;
