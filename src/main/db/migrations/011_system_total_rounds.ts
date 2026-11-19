/**
 * Persist lifetime rounds on each build (incremented from shooting logs).
 */
export const id = 11
export const name = '011_system_total_rounds'

export const sql = `
ALTER TABLE systems ADD COLUMN total_rounds INTEGER NOT NULL DEFAULT 0;

UPDATE systems
SET total_rounds = COALESCE((
  SELECT SUM(rounds_fired) FROM shooting_logs WHERE shooting_logs.system_id = systems.id
), 0);
`