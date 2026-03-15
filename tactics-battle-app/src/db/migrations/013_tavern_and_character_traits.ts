export const MIGRATION_013 = `
ALTER TABLE characters ADD COLUMN base_spi INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN age INTEGER NOT NULL DEFAULT 18;
ALTER TABLE characters ADD COLUMN growth_multiplier REAL NOT NULL DEFAULT 1;
ALTER TABLE characters ADD COLUMN trait_ids_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE characters ADD COLUMN innate_hp_rate REAL NOT NULL DEFAULT 1;
ALTER TABLE characters ADD COLUMN innate_atk_bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN innate_def_bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN innate_spi_bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN innate_spd_bonus INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS tavern_candidates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  class_id TEXT NOT NULL CHECK (class_id IN ('GUARDIAN', 'SWORDMAN', 'BERSERKER', 'CLERIC', 'WITCH', 'THIEF', 'PORTER')),
  constellation_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  age INTEGER NOT NULL,
  growth_multiplier REAL NOT NULL,
  trait_ids_json TEXT NOT NULL,
  price_gold INTEGER NOT NULL,
  base_max_hp INTEGER NOT NULL,
  base_atk INTEGER NOT NULL,
  base_def INTEGER NOT NULL,
  base_spi INTEGER NOT NULL,
  base_spd INTEGER NOT NULL,
  base_max_mp INTEGER NOT NULL,
  base_mp_regen INTEGER NOT NULL,
  innate_hp_rate REAL NOT NULL,
  innate_atk_bonus INTEGER NOT NULL,
  innate_def_bonus INTEGER NOT NULL,
  innate_spi_bonus INTEGER NOT NULL,
  innate_spd_bonus INTEGER NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tavern_refresh_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_generated_at TEXT NOT NULL,
  next_refresh_at TEXT NOT NULL,
  seed INTEGER NOT NULL
);
`;
