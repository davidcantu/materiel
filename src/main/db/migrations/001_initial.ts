/**
 * Initial schema — software-spec §3 entities for single-user local-first.
 */
export const id = 1
export const name = '001_initial'

export const sql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  competition_series TEXT NOT NULL DEFAULT '[]',
  profile_image_url TEXT,
  track_value INTEGER NOT NULL DEFAULT 1,
  track_ammo INTEGER NOT NULL DEFAULT 1,
  unlock_pin_set INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL DEFAULT '',
  value REAL NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('Action', 'Barrel', 'Chassis', 'Optic', 'Suppressor', 'Misc')),
  status TEXT NOT NULL DEFAULT 'In Stock'
    CHECK (status IN ('In Stock', 'In Use', 'Retired', 'Sold')),
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

CREATE INDEX IF NOT EXISTS idx_parts_type ON parts(type);
CREATE INDEX IF NOT EXISTS idx_parts_status ON parts(status);

CREATE TABLE IF NOT EXISTS systems (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  build_type TEXT NOT NULL DEFAULT 'custom' CHECK (build_type IN ('custom', 'factory')),
  action_id TEXT NOT NULL REFERENCES parts(id),
  barrel_id TEXT NOT NULL REFERENCES parts(id),
  chassis_id TEXT NOT NULL REFERENCES parts(id),
  optic_id TEXT REFERENCES parts(id),
  suppressor_id TEXT REFERENCES parts(id),
  image_url TEXT,
  image_scale REAL DEFAULT 1,
  notes TEXT,
  factory_manufacturer TEXT,
  factory_model TEXT,
  factory_cartridge TEXT,
  factory_action_maintenance INTEGER,
  factory_barrel_maintenance INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_misc_parts (
  system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  part_id TEXT NOT NULL REFERENCES parts(id),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (system_id, part_id)
);

CREATE TABLE IF NOT EXISTS load_developments (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  caliber TEXT NOT NULL,
  bullet_manufacturer TEXT NOT NULL,
  bullet_model TEXT NOT NULL,
  brass_manufacturer TEXT NOT NULL,
  brass_model TEXT,
  powder_manufacturer TEXT NOT NULL,
  powder_model TEXT NOT NULL,
  primer_manufacturer TEXT NOT NULL,
  primer_model TEXT NOT NULL,
  powder_charge REAL NOT NULL,
  coal REAL NOT NULL,
  cbto REAL,
  velocity REAL,
  sd REAL,
  es REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ammo_inventory (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Factory' CHECK (type IN ('Factory', 'Handload')),
  caliber TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  load_id TEXT REFERENCES load_developments(id) ON DELETE SET NULL,
  manufacturer TEXT,
  lot_number TEXT,
  notes TEXT,
  bullet_manufacturer TEXT,
  bullet_type TEXT,
  powder_manufacturer TEXT,
  powder TEXT,
  charge_weight REAL,
  primer_manufacturer TEXT,
  primer TEXT,
  case_manufacturer TEXT,
  case_name TEXT,
  seating_depth TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ammo_caliber ON ammo_inventory(caliber);

CREATE TABLE IF NOT EXISTS shooting_logs (
  id TEXT PRIMARY KEY NOT NULL,
  system_id TEXT NOT NULL REFERENCES systems(id),
  barrel_id TEXT NOT NULL REFERENCES parts(id),
  ammo_id TEXT REFERENCES ammo_inventory(id) ON DELETE SET NULL,
  cartridge TEXT,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  rounds_fired INTEGER NOT NULL CHECK (rounds_fired >= 0),
  velocity REAL,
  session_type TEXT NOT NULL DEFAULT 'Practice' CHECK (session_type IN ('Practice', 'Match')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shooting_logs_date ON shooting_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_shooting_logs_system ON shooting_logs(system_id);

CREATE TABLE IF NOT EXISTS backup_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  auto_backup_enabled INTEGER NOT NULL DEFAULT 1,
  backup_interval_hours INTEGER NOT NULL DEFAULT 24,
  provider TEXT,
  last_backup_time TEXT,
  next_backup_time TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_logs (
  id TEXT PRIMARY KEY NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Full', 'User')),
  target_user_email TEXT,
  status TEXT NOT NULL CHECK (status IN ('Success', 'Failed')),
  file_name TEXT NOT NULL,
  file_size TEXT NOT NULL DEFAULT '',
  record_count TEXT NOT NULL DEFAULT '{}',
  local_path TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS license_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
  key_present INTEGER NOT NULL DEFAULT 0,
  key_fingerprint TEXT,
  activated_at TEXT,
  updated_at TEXT NOT NULL
);
`
