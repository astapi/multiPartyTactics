export const MIGRATION_002 = `
CREATE TABLE IF NOT EXISTS equipment_inventory_stacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_item_id TEXT NOT NULL,
  mutation_prefix_id TEXT,
  mutation_prefix_key TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (base_item_id, mutation_prefix_key)
);

CREATE TABLE IF NOT EXISTS equipment_grants (
  grant_key TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('MONSTER_DROP', 'TREASURE_CHEST', 'SHOP_PURCHASE', 'ADMIN')),
  base_item_id TEXT NOT NULL,
  mutation_prefix_id TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  context_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipment_stacks_base_item ON equipment_inventory_stacks(base_item_id);
CREATE INDEX IF NOT EXISTS idx_equipment_grants_source_type ON equipment_grants(source_type);
`;
