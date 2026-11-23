/**
 * Load development fields for case prep / lands; identity-only required.
 * Shooting log barrel_id becomes nullable with ON DELETE SET NULL so Retired
 * (or other unused) parts can be deleted without wiping session history.
 */
export const id = 12
export const name = '012_load_fields_nullable_barrel'

// migrate() disables foreign_keys outside the wrapping transaction.
export const sql = `
PRAGMA foreign_keys = OFF;

CREATE TABLE load_developments_new (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  caliber TEXT NOT NULL,
  bullet_manufacturer TEXT NOT NULL DEFAULT '',
  bullet_model TEXT NOT NULL DEFAULT '',
  brass_manufacturer TEXT NOT NULL DEFAULT '',
  brass_model TEXT,
  powder_manufacturer TEXT NOT NULL DEFAULT '',
  powder_model TEXT NOT NULL DEFAULT '',
  primer_manufacturer TEXT NOT NULL DEFAULT '',
  primer_model TEXT NOT NULL DEFAULT '',
  powder_charge REAL,
  coal REAL,
  shoulder_bump REAL,
  neck_tension REAL,
  lands REAL,
  cbto REAL,
  velocity REAL,
  sd REAL,
  es REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO load_developments_new (
  id, name, caliber,
  bullet_manufacturer, bullet_model,
  brass_manufacturer, brass_model,
  powder_manufacturer, powder_model,
  primer_manufacturer, primer_model,
  powder_charge, coal, shoulder_bump, neck_tension, lands,
  cbto, velocity, sd, es, notes,
  created_at, updated_at
)
SELECT
  id, name, caliber,
  COALESCE(bullet_manufacturer, ''), COALESCE(bullet_model, ''),
  COALESCE(brass_manufacturer, ''), brass_model,
  COALESCE(powder_manufacturer, ''), COALESCE(powder_model, ''),
  COALESCE(primer_manufacturer, ''), COALESCE(primer_model, ''),
  powder_charge, coal, NULL, NULL, NULL,
  cbto, velocity, sd, es, notes,
  created_at, updated_at
FROM load_developments;

DROP TABLE load_developments;
ALTER TABLE load_developments_new RENAME TO load_developments;

CREATE TABLE shooting_logs_new (
  id TEXT PRIMARY KEY NOT NULL,
  system_id TEXT REFERENCES systems(id) ON DELETE SET NULL,
  barrel_id TEXT REFERENCES parts(id) ON DELETE SET NULL,
  ammo_id TEXT REFERENCES ammo_inventory(id) ON DELETE SET NULL,
  cartridge TEXT,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  rounds_fired INTEGER NOT NULL CHECK (rounds_fired >= 0),
  velocity REAL,
  session_type TEXT NOT NULL DEFAULT 'Practice' CHECK (session_type IN ('Practice', 'Match')),
  placement INTEGER,
  percent_of_winner REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO shooting_logs_new (
  id, system_id, barrel_id, ammo_id, cartridge, date, location,
  rounds_fired, velocity, session_type, placement, percent_of_winner,
  notes, created_at, updated_at
)
SELECT
  id, system_id, barrel_id, ammo_id, cartridge, date, location,
  rounds_fired, velocity, session_type, placement, percent_of_winner,
  notes, created_at, updated_at
FROM shooting_logs;

DROP TABLE shooting_logs;
ALTER TABLE shooting_logs_new RENAME TO shooting_logs;

CREATE INDEX IF NOT EXISTS idx_shooting_logs_date ON shooting_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_shooting_logs_system ON shooting_logs(system_id);
CREATE INDEX IF NOT EXISTS idx_shooting_logs_barrel ON shooting_logs(barrel_id);

PRAGMA foreign_keys = ON;
`