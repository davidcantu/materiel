/**
 * Allow shooting logs to outlive their build: system_id becomes nullable with
 * ON DELETE SET NULL so deleting a build keeps session history and part round counts.
 */
export const id = 10
export const name = '010_logs_nullable_system'

// migrate() disables foreign_keys outside the wrapping transaction.
export const sql = `
PRAGMA foreign_keys = OFF;

CREATE TABLE shooting_logs_new (
  id TEXT PRIMARY KEY NOT NULL,
  system_id TEXT REFERENCES systems(id) ON DELETE SET NULL,
  barrel_id TEXT NOT NULL REFERENCES parts(id),
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