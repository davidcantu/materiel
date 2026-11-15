/**
 * Drop parts.name — inventory is identified by id; UI shows manufacturer/model/caliber.
 */
export const id = 2
export const name = '002_drop_part_name'

export const sql = `
ALTER TABLE parts DROP COLUMN name;
`
