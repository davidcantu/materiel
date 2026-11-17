/**
 * Sold-to note on parts; match place + % of winner on shooting logs.
 */
export const id = 8
export const name = '008_sold_note_match_place'

export const sql = `
ALTER TABLE parts ADD COLUMN sold_to_note TEXT;

ALTER TABLE shooting_logs ADD COLUMN placement INTEGER;
ALTER TABLE shooting_logs ADD COLUMN percent_of_winner REAL;
`
