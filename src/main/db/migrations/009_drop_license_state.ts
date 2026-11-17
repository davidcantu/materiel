/**
 * Materiel is free and unlimited — drop the paid/free license_state table.
 */
export const id = 9
export const name = '009_drop_license_state'

export const sql = `
DROP TABLE IF EXISTS license_state;
`
