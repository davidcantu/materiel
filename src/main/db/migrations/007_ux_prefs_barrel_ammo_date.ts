/**
 * UX notes 2026-11-16:
 * - Barrel name (parts.name) for round-count naming
 * - Ammo acquired_date (made/purchased)
 * - Profile: tracked platforms, track loads, onboarding complete
 */
export const id = 7
export const name = '007_ux_prefs_barrel_ammo_date'

export const sql = `
ALTER TABLE parts ADD COLUMN name TEXT;

ALTER TABLE ammo_inventory ADD COLUMN acquired_date TEXT;

ALTER TABLE profile ADD COLUMN track_loads INTEGER NOT NULL DEFAULT 1;
ALTER TABLE profile ADD COLUMN tracked_platforms TEXT NOT NULL DEFAULT '["bolt_action","ar_pattern","pistol"]';
ALTER TABLE profile ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 1;
`
