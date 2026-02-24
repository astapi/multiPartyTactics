export const MIGRATION_003 = `
CREATE TABLE IF NOT EXISTS character_equipment_slots (
  character_id TEXT NOT NULL,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('weapon', 'armor')),
  base_item_id TEXT NOT NULL,
  mutation_prefix_id TEXT,
  equipped_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (character_id, slot_type),
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_character_equipment_character
  ON character_equipment_slots(character_id);
`;

