export const MIGRATION_010 = `
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  gold INTEGER NOT NULL CHECK (gold >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shop_equipment_catalog (
  base_item_id TEXT PRIMARY KEY,
  price_gold INTEGER NOT NULL CHECK (price_gold >= 0),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shop_purchase_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_item_id TEXT NOT NULL,
  mutation_prefix_id TEXT,
  price_gold INTEGER NOT NULL CHECK (price_gold >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shop_catalog_enabled ON shop_equipment_catalog(is_enabled);
CREATE INDEX IF NOT EXISTS idx_shop_purchase_logs_item ON shop_purchase_logs(base_item_id);

INSERT OR IGNORE INTO wallets (id, gold, updated_at)
VALUES ('main', 12450, CURRENT_TIMESTAMP);
`;
