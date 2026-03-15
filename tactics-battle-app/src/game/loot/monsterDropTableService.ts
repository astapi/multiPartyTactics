import { listNormalEncounterEnemyIds } from "@/game/encounter";
import monsterDropTableData from "@/data/monsterDropTable.json";
import { getEquipmentById } from "@/game/loot/equipmentMasterService";
import type { MonsterDropTableEntry } from "@/types/equipment";

type MonsterDropTableJson = {
  drops: MonsterDropTableEntry[];
};

let cached: Map<string, string[]> | null = null;

const validate = (entries: MonsterDropTableEntry[]): Map<string, string[]> => {
  const byEnemyId = new Map<string, string[]>();

  for (const entry of entries) {
    if (byEnemyId.has(entry.enemyId)) {
      throw new Error(`Duplicate monster drop enemy id: ${entry.enemyId}`);
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
    byEnemyId.set(entry.enemyId, [...entry.baseItemIds]);
  }

  for (const enemyId of listNormalEncounterEnemyIds()) {
    if (!byEnemyId.has(enemyId)) {
      throw new Error(`Missing monster drop mapping for encounter enemy: ${enemyId}`);
    }
  }

  return byEnemyId;
};

const init = (): Map<string, string[]> => {
  if (cached) return cached;
  const raw = monsterDropTableData as MonsterDropTableJson;
  cached = validate(raw.drops);
  return cached;
};

export const getMonsterDropBaseItemIds = (enemyId: string): string[] => init().get(enemyId) ?? [];

export const listMonsterDropEntries = (): MonsterDropTableEntry[] =>
  [...init()].map(([enemyId, baseItemIds]) => ({ enemyId, baseItemIds: [...baseItemIds] }));
