export const MIGRATION_006 = `
CREATE TABLE IF NOT EXISTS dungeon_party_ui_state (
  party_id TEXT NOT NULL,
  dungeon_id TEXT NOT NULL,
  selected_floor INTEGER,
  step_count INTEGER NOT NULL DEFAULT 40,
  mode TEXT NOT NULL DEFAULT 'IDLE' CHECK (mode IN ('IDLE', 'EXPLORE', 'AUTO')),
  auto_run_count INTEGER NOT NULL DEFAULT 0,
  auto_loot_count INTEGER NOT NULL DEFAULT 0,
  auto_elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (party_id, dungeon_id),
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
  FOREIGN KEY (dungeon_id) REFERENCES dungeons(id) ON DELETE CASCADE
);
`;
