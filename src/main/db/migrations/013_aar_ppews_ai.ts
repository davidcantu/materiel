/**
 * After-Action Reviews, PPEWS, COF attachments/stages, AI analyses, AAR prefs.
 */
export const id = 13
export const name = '013_aar_ppews_ai'

export const sql = `
ALTER TABLE profile ADD COLUMN aar_prompt_on_practice INTEGER NOT NULL DEFAULT 0;

CREATE TABLE aar (
  id TEXT PRIMARY KEY,
  log_entry_id TEXT REFERENCES shooting_logs(id) ON DELETE SET NULL,
  barrel_id TEXT REFERENCES parts(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'complete')),
  match_name TEXT,
  match_date_start TEXT,
  match_date_end TEXT,
  venue TEXT,
  match_level TEXT CHECK (match_level IS NULL OR match_level IN ('club','regional','national','practice','other')),
  division TEXT,
  score REAL,
  score_possible REAL,
  placement INTEGER,
  field_size INTEGER,
  rounds_fired INTEGER,
  mindset TEXT,
  rifle_setup TEXT,
  goals TEXT,
  what_went_right TEXT,
  lessons_learned TEXT,
  training_plan TEXT,
  final_thoughts TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_aar_one_per_log ON aar(log_entry_id) WHERE log_entry_id IS NOT NULL;
CREATE INDEX idx_aar_updated ON aar(updated_at DESC);
CREATE INDEX idx_aar_status ON aar(status);

CREATE TABLE aar_ppews (
  id TEXT PRIMARY KEY,
  aar_id TEXT NOT NULL REFERENCES aar(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('preparation','process','elevation','wind','stability','other')),
  points_dropped INTEGER NOT NULL DEFAULT 0 CHECK (points_dropped >= 0),
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  notes TEXT,
  UNIQUE (aar_id, category)
);

CREATE TABLE aar_attachment (
  id TEXT PRIMARY KEY,
  aar_id TEXT NOT NULL REFERENCES aar(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  ai_relative_path TEXT,
  content_hash TEXT,
  mime_type TEXT NOT NULL,
  page_index INTEGER,
  original_filename TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_aar_attachment_aar ON aar_attachment(aar_id, sort_order);

CREATE TABLE aar_stage (
  id TEXT PRIMARY KEY,
  aar_id TEXT NOT NULL REFERENCES aar(id) ON DELETE CASCADE,
  attachment_id TEXT REFERENCES aar_attachment(id) ON DELETE SET NULL,
  stage_number INTEGER,
  stage_name TEXT,
  description TEXT,
  targets_json TEXT,
  round_count INTEGER,
  par_time_sec REAL,
  handwritten_notes TEXT,
  confirmed_at TEXT
);

CREATE INDEX idx_aar_stage_aar ON aar_stage(aar_id);

CREATE TABLE ai_analysis (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  usage_json TEXT
);

CREATE INDEX idx_ai_analysis_created ON ai_analysis(created_at DESC);
`
