export const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  class_id TEXT NOT NULL CHECK (class_id IN ('GUARDIAN', 'SWORDMAN', 'BERSERKER', 'CLERIC', 'WITCH', 'THIEF')),
  constellation_id TEXT NOT NULL DEFAULT 'ARIES',
  level INTEGER DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
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
  UNIQUE (character_id),
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

CREATE TABLE IF NOT EXISTS dungeons (
  id TEXT PRIMARY KEY,
  min_floor INTEGER NOT NULL,
  max_floor INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_bonus INTEGER NOT NULL DEFAULT 0 CHECK (is_bonus IN (0, 1)),
  parent_dungeon_id TEXT,
  unlock_from_dungeon_id TEXT,
  unlock_from_floor INTEGER,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  FOREIGN KEY (parent_dungeon_id) REFERENCES dungeons(id),
  FOREIGN KEY (unlock_from_dungeon_id) REFERENCES dungeons(id)
);

CREATE INDEX IF NOT EXISTS idx_dungeons_sort_order ON dungeons(sort_order);

CREATE TABLE IF NOT EXISTS unlocked_dungeons (
  dungeon_id TEXT PRIMARY KEY,
  unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unlock_reason TEXT,
  FOREIGN KEY (dungeon_id) REFERENCES dungeons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dungeon_progress (
  dungeon_id TEXT PRIMARY KEY,
  last_entered_floor INTEGER NOT NULL DEFAULT 1,
  max_cleared_floor INTEGER NOT NULL DEFAULT 0,
  clear_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dungeon_id) REFERENCES dungeons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS battle_sessions (
  id TEXT PRIMARY KEY,
  dungeon_id TEXT NOT NULL,
  floor INTEGER NOT NULL,
  turn INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'WIN', 'LOSE', 'DRAW')),
  exploration_seed INTEGER,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  FOREIGN KEY (dungeon_id) REFERENCES dungeons(id)
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

INSERT OR IGNORE INTO dungeons
(id, min_floor, max_floor, sort_order, is_bonus, is_enabled)
VALUES
('crestoria_dungeon_1_200', 1, 200, 5, 0, 1);

INSERT OR IGNORE INTO unlocked_dungeons (dungeon_id, unlock_reason)
VALUES
('crestoria_dungeon_1_200', 'initial');
`;
