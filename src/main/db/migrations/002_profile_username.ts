/**
 * Local identity: username on the single profile row (first-run, no password).
 */
export const id = 2
export const name = '002_profile_username'

export const sql = `
ALTER TABLE profile ADD COLUMN username TEXT NOT NULL DEFAULT '';
`
