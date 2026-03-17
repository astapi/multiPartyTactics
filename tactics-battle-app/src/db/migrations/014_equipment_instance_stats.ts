export const MIGRATION_014 = `
ALTER TABLE equipment_grants ADD COLUMN granted_stats_json TEXT;

CREATE TABLE IF NOT EXISTS equipment_inventory_stacks_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_item_id TEXT NOT NULL,
  mutation_prefix_id TEXT,
  mutation_prefix_key TEXT NOT NULL,
  stats_key TEXT NOT NULL DEFAULT '',
  granted_stats_json TEXT,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (base_item_id, mutation_prefix_key, stats_key)
);

INSERT INTO equipment_inventory_stacks_v2
  (id, base_item_id, mutation_prefix_id, mutation_prefix_key, stats_key, granted_stats_json, quantity, created_at, updated_at)
SELECT
  id,
  base_item_id,
  mutation_prefix_id,
  mutation_prefix_key,
  '',
  NULL,
  quantity,
  created_at,
  updated_at
FROM equipment_inventory_stacks;

DROP TABLE equipment_inventory_stacks;
ALTER TABLE equipment_inventory_stacks_v2 RENAME TO equipment_inventory_stacks;
CREATE INDEX IF NOT EXISTS idx_equipment_stacks_base_item ON equipment_inventory_stacks(base_item_id);

ALTER TABLE character_equipment_slots ADD COLUMN granted_stats_json TEXT;
`;
