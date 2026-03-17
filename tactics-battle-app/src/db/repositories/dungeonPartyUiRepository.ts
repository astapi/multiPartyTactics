import { getDb } from "@/db/database";
import { DungeonPartyUiMode, DungeonPartyUiStateRecord } from "@/types/models";
import { DEFAULT_DUNGEON_RETURN_CONDITION, normalizeDungeonReturnCondition } from "@/game/explorationReturn";

type DungeonPartyUiRow = {
  party_id: string;
  dungeon_id: string;
  selected_floor: number | null;
  step_count: number | null;
  return_condition: string | null;
  mode: DungeonPartyUiMode;
  auto_run_count: number;
  auto_loot_count: number;
  auto_elapsed_seconds: number;
  updated_at: string;
};

const mapRow = (row: DungeonPartyUiRow): DungeonPartyUiStateRecord => ({
  partyId: row.party_id,
  dungeonId: row.dungeon_id,
  selectedFloor: row.selected_floor,
  returnCondition: normalizeDungeonReturnCondition(row.return_condition ?? DEFAULT_DUNGEON_RETURN_CONDITION),
  mode: row.mode,
  autoRunCount: row.auto_run_count,
  autoLootCount: row.auto_loot_count,
  autoElapsedSeconds: row.auto_elapsed_seconds,
  updatedAt: row.updated_at,
});

export const dungeonPartyUiRepository = {
  async listByDungeon(dungeonId: string): Promise<DungeonPartyUiStateRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<DungeonPartyUiRow>(
      `SELECT party_id, dungeon_id, selected_floor, step_count, return_condition, mode, auto_run_count, auto_loot_count, auto_elapsed_seconds, updated_at
       FROM dungeon_party_ui_state
       WHERE dungeon_id = ?
       ORDER BY party_id ASC`,
      [dungeonId]
    );
    return rows.map(mapRow);
  },

  async upsert(state: Omit<DungeonPartyUiStateRecord, "updatedAt">): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO dungeon_party_ui_state
        (party_id, dungeon_id, selected_floor, step_count, return_condition, mode, auto_run_count, auto_loot_count, auto_elapsed_seconds, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(party_id, dungeon_id) DO UPDATE SET
         selected_floor = excluded.selected_floor,
         step_count = excluded.step_count,
         return_condition = excluded.return_condition,
         mode = excluded.mode,
         auto_run_count = excluded.auto_run_count,
         auto_loot_count = excluded.auto_loot_count,
         auto_elapsed_seconds = excluded.auto_elapsed_seconds,
         updated_at = CURRENT_TIMESTAMP`,
      [
        state.partyId,
        state.dungeonId,
        state.selectedFloor,
        40,
        state.returnCondition,
        state.mode,
        state.autoRunCount,
        state.autoLootCount,
        state.autoElapsedSeconds,
      ]
    );
  },

  async ensureDefaultsForParties(params: { dungeonId: string; partyIds: string[] }): Promise<void> {
    const { dungeonId, partyIds } = params;
    if (partyIds.length === 0) return;
    const db = await getDb();
    for (const partyId of partyIds) {
      await db.runAsync(
        `INSERT OR IGNORE INTO dungeon_party_ui_state
          (party_id, dungeon_id, selected_floor, step_count, return_condition, mode, auto_run_count, auto_loot_count, auto_elapsed_seconds)
         VALUES (?, ?, NULL, 40, ?, 'IDLE', 0, 0, 0)`,
        [partyId, dungeonId, DEFAULT_DUNGEON_RETURN_CONDITION]
      );
    }
  },
};
