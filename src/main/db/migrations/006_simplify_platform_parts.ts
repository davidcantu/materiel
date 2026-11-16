/**
 * Simplify platform part lists: Pistol + Trigger types, Frame→Pistol,
 * suppressor serials already supported via serial_number column.
 * Collapses pistol core slots onto the primary pistol part.
 */
export const id = 6
export const name = '006_simplify_platform_parts'

// Note: migrate() disables foreign_keys outside the wrapping transaction.
// PRAGMA foreign_keys cannot change mid-transaction in SQLite (no-op).
export const sql = `
PRAGMA foreign_keys = OFF;

CREATE TABLE parts_new (
  id TEXT PRIMARY KEY NOT NULL,
  manufacturer TEXT NOT NULL DEFAULT '',
  value REAL NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN (
    'Action', 'Barrel', 'Chassis', 'Optic', 'Suppressor', 'Misc',
    'Lower', 'Upper', 'Handguard', 'BCG', 'GasBlock', 'Stock',
    'Frame', 'Slide', 'LaserIR', 'Light', 'Pistol', 'Trigger'
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
  id, manufacturer, value,
  CASE type WHEN 'Frame' THEN 'Pistol' ELSE type END,
  status, platforms, model, serial_number,
  total_round_count, rounds_after_cleaning, maintenance_interval,
  caliber, gunsmith, twist_rate, barrel_life, muzzle_type, notes,
  created_at, updated_at
FROM parts;

DROP TABLE parts;
ALTER TABLE parts_new RENAME TO parts;

CREATE INDEX IF NOT EXISTS idx_parts_type ON parts(type);
CREATE INDEX IF NOT EXISTS idx_parts_status ON parts(status);

-- Pistol builds: point barrel/chassis columns at the primary pistol part.
UPDATE systems
SET
  barrel_id = action_id,
  chassis_id = action_id
WHERE platform = 'pistol';

-- AR inventory no longer includes Optic as a platform category.
UPDATE systems SET optic_id = NULL WHERE platform = 'ar_pattern';

PRAGMA foreign_keys = ON;
`