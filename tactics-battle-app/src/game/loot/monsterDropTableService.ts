import { listNormalEncounterEnemyIds } from "@/game/encounter";
import monsterDropTableData from "@/data/monsterDropTable.json";
import { getEquipmentById } from "@/game/loot/equipmentMasterService";
import type { MonsterDropTableEntry } from "@/types/equipment";

type MonsterDropTableJson = {
  drops: MonsterDropTableEntry[];
};

type ResolvedMonsterDropEntry = {
  gold: number;
  baseItemIds: string[];
};

let cached: Map<string, ResolvedMonsterDropEntry> | null = null;

const validate = (entries: MonsterDropTableEntry[]): Map<string, ResolvedMonsterDropEntry> => {
  const byEnemyId = new Map<string, ResolvedMonsterDropEntry>();

  for (const entry of entries) {
    if (byEnemyId.has(entry.enemyId)) {
      throw new Error(`Duplicate monster drop enemy id: ${entry.enemyId}`);
    }
    if (!Number.isFinite(entry.gold) || entry.gold <= 0) {
      throw new Error(`Monster drop gold must be positive: ${entry.enemyId}`);
    }
    if (entry.baseItemIds.length === 0) {
      throw new Error(`Monster drop entry must define at least one baseItemId: ${entry.enemyId}`);
    }
    for (const baseItemId of entry.baseItemIds) {
      const item = getEquipmentById(baseItemId);
      if (item.source !== "monster") {
        throw new Error(`Monster drop item must be source=monster: ${baseItemId}`);
      }
    }
    byEnemyId.set(entry.enemyId, {
      gold: Math.floor(entry.gold),
      baseItemIds: [...entry.baseItemIds],
    });
  }

  for (const enemyId of listNormalEncounterEnemyIds()) {
    if (!byEnemyId.has(enemyId)) {
      throw new Error(`Missing monster drop mapping for encounter enemy: ${enemyId}`);
    }
  }

  return byEnemyId;
};

const init = (): Map<string, ResolvedMonsterDropEntry> => {
  if (cached) return cached;
  const raw = monsterDropTableData as MonsterDropTableJson;
  cached = validate(raw.drops);
  return cached;
};

export const getMonsterDropBaseItemIds = (enemyId: string): string[] =>
  init().get(enemyId)?.baseItemIds ?? [];

export const getMonsterDropGold = (enemyId: string): number =>
  init().get(enemyId)?.gold ?? 0;

export const listMonsterDropEntries = (): MonsterDropTableEntry[] =>
  [...init()].map(([enemyId, entry]) => ({
    enemyId,
    gold: entry.gold,
    baseItemIds: [...entry.baseItemIds],
  }));
