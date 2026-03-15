import { getDb } from "@/db/database";
import { BattleLogRecord, BattleSessionRecord } from "@/types/models";

const mapSession = (row: any): BattleSessionRecord => ({
  id: row.id,
  dungeonId: row.dungeon_id,
  floor: row.floor,
  turn: row.turn,
  status: row.status,
  explorationSeed: row.exploration_seed ?? null,
  startedAt: row.started_at,
  endedAt: row.ended_at ?? null,
});

const mapLog = (row: any): BattleLogRecord => ({
  id: row.id,
  battleSessionId: row.battle_session_id,
  turn: row.turn,
  actorId: null,
  actorName: row.actor_name,
  actionType: row.action_type,
  targetName: row.target_name,
  damage: row.damage,
  healing: row.healing,
  logMessage: row.log_message,
});

export const battleRepository = {
  async createSession(session: BattleSessionRecord): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO battle_sessions
      (id, dungeon_id, floor, turn, status, exploration_seed, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.dungeonId,
        session.floor,
        session.turn,
        session.status,
        session.explorationSeed,
        session.startedAt,
        session.endedAt,
      ]
    );
  },

  async updateSessionStatus(id: string, status: BattleSessionRecord["status"]): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE battle_sessions SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?",
      [status, id]
    );
  },

  async appendLogs(logs: BattleLogRecord[]): Promise<void> {
    const db = await getDb();
    for (const log of logs) {
      await db.runAsync(
        `INSERT INTO battle_logs
        (battle_session_id, turn, actor_name, action_type, target_name, damage, healing, log_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          log.battleSessionId,
          log.turn,
          log.actorName,
          log.actionType,
          log.targetName,
          log.damage,
          log.healing,
          log.logMessage,
        ]
      );
    }
  },

  async listLogs(sessionId: string): Promise<BattleLogRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM battle_logs WHERE battle_session_id = ? ORDER BY id ASC",
      [sessionId]
    );
    return rows.map(mapLog);
  },

  async getSessionById(id: string): Promise<BattleSessionRecord | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>("SELECT * FROM battle_sessions WHERE id = ?", [id]);
    return row ? mapSession(row) : null;
  },
};
