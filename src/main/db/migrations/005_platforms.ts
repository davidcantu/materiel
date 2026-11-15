/**
 * Multi-platform inventory: platforms on parts/systems, expanded part types,
 * laser/IR + light slots on complete systems.
 *
 * Parts table is rebuilt to expand the type CHECK. Systems keeps its row ids
 * (shooting_logs / system_misc_parts FKs) via ALTER TABLE ADD COLUMN.
 */
export const id = 5
export const name = '005_platforms'

export const sql = `
PRAGMA foreign_keys = OFF;

CREATE TABLE parts_new (
  id TEXT PRIMARY KEY NOT NULL,
  manufacturer TEXT NOT NULL DEFAULT '',
  value REAL NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN (
    'Action', 'Barrel', 'Chassis', 'Optic', 'Suppressor', 'Misc',
    'Lower', 'Upper', 'Handguard', 'BCG', 'GasBlock', 'Stock',
    'Frame', 'Slide', 'LaserIR', 'Light'
  )),
  status TEXT NOT NULL DEFAULT 'In Stock'
    CHECK (status IN ('In Stock', 'In Use', 'Retired', 'Sold')),
  platforms TEXT NOT NULL DEFAULT '["bolt_action"]',
  model TEXT,
  serial_number TEXT,
  total_round_count INTEGER NOT NULL DEFAULT 0,
  rounds_after_cleaning INTEGER NOT NULL DEFAULT 0,
  maintenance_interval INTEGER,
  caliber TEXT,
  gunsmith TEXT,
  twist_rate REAL,
  barrel_life INTEGER,
  muzzle_type TEXT CHECK (muzzle_type IS NULL OR muzzle_type IN ('Suppressor', 'Brake')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO parts_new (
  id, manufacturer, value, type, status, platforms, model, serial_number,
  total_round_count, rounds_after_cleaning, maintenance_interval,
  caliber, gunsmith, twist_rate, barrel_life, muzzle_type, notes,
  created_at, updated_at
)
SELECT
  id, manufacturer, value, type, status, '["bolt_action"]', model, serial_number,
  total_round_count, rounds_after_cleaning, maintenance_interval,
  caliber, gunsmith, twist_rate, barrel_life, muzzle_type, notes,
  created_at, updated_at
FROM parts;

DROP TABLE parts;
ALTER TABLE parts_new RENAME TO parts;

CREATE INDEX IF NOT EXISTS idx_parts_type ON parts(type);
CREATE INDEX IF NOT EXISTS idx_parts_status ON parts(status);

ALTER TABLE systems ADD COLUMN platform TEXT NOT NULL DEFAULT 'bolt_action';
ALTER TABLE systems ADD COLUMN laser_ir_id TEXT REFERENCES parts(id);
ALTER TABLE systems ADD COLUMN light_id TEXT REFERENCES parts(id);

PRAGMA foreign_keys = ON;
`
