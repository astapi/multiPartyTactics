export const MIGRATION_011 = `
CREATE TABLE IF NOT EXISTS consumable_inventory (
  item_id TEXT PRIMARY KEY,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consumable_inventory_item ON consumable_inventory(item_id);
`;
