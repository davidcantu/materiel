/**
 * Local identity: username on the single profile row (first-run, no password).
 */
export const id = 3
export const name = '003_profile_username'

export const sql = `
ALTER TABLE profile ADD COLUMN username TEXT NOT NULL DEFAULT '';
`
