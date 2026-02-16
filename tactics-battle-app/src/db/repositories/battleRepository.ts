import { getDb } from "@/db/database";
import { BattleLogRecord, BattleSessionRecord } from "@/types/models";

const mapSession = (row: any): BattleSessionRecord => ({
  id: row.id,
  dungeonProgressId: row.dungeon_progress_id,
  turn: row.turn,
  status: row.status,
});

const mapLog = (row: any): BattleLogRecord => ({
  id: row.id,
  battleSessionId: row.battle_session_id,
  turn: row.turn,
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
      "INSERT INTO battle_sessions (id, dungeon_progress_id, turn, status) VALUES (?, ?, ?, ?)",
      [session.id, session.dungeonProgressId, session.turn, session.status]
    );
  },

  async updateSessionStatus(id: string, status: BattleSessionRecord["status"]): Promise<void> {
    const db = await getDb();
    await db.runAsync("UPDATE battle_sessions SET status = ? WHERE id = ?", [status, id]);
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
