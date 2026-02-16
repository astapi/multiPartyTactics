export const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  job_id TEXT NOT NULL CHECK (job_id IN ('GUARDIAN', 'SWORDMAN', 'BERSERKER', 'CLERIC', 'WITCH', 'THIEF')),
  level INTEGER DEFAULT 1,
  base_max_hp INTEGER,
  base_atk INTEGER,
  base_def INTEGER,
  base_spd INTEGER,
  base_max_mp INTEGER,
  base_mp_regen INTEGER,
  current_hp INTEGER,
  current_mp INTEGER
);

CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS party_members (
  party_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  slot_index INTEGER NOT NULL,
  PRIMARY KEY (party_id, slot_index),
  UNIQUE (party_id, character_id),
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO parties (id, name) VALUES ('party_default', 'Main Party');

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS tactics_rules (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  priority INTEGER NOT NULL,
  skill_id TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  condition_params TEXT,
  target_type TEXT NOT NULL,
  target_params TEXT,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dungeon_progress (
  id TEXT PRIMARY KEY,
  dungeon_id TEXT NOT NULL,
  current_floor INTEGER DEFAULT 1,
  is_cleared INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS battle_sessions (
  id TEXT PRIMARY KEY,
  dungeon_progress_id TEXT,
  turn INTEGER DEFAULT 1,
  status TEXT DEFAULT 'IN_PROGRESS'
);

CREATE TABLE IF NOT EXISTS battle_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  battle_session_id TEXT,
  turn INTEGER,
  actor_name TEXT,
  action_type TEXT,
  target_name TEXT,
  damage INTEGER,
  healing INTEGER,
  log_message TEXT
);
`;
