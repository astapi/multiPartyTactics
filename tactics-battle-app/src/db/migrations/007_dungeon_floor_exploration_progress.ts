export const MIGRATION_007 = `
CREATE TABLE IF NOT EXISTS dungeon_floor_exploration_progress (
  dungeon_id TEXT NOT NULL,
  floor INTEGER NOT NULL,
  exploration_percent INTEGER NOT NULL DEFAULT 0,
  stairs_discovered INTEGER NOT NULL DEFAULT 0 CHECK (stairs_discovered IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (dungeon_id, floor),
  FOREIGN KEY (dungeon_id) REFERENCES dungeons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dungeon_floor_exploration_progress_dungeon_floor
  ON dungeon_floor_exploration_progress(dungeon_id, floor);
`;
