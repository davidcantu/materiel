/**
 * Email is the single local identity (username for license pairing).
 * Prefer existing email; if missing and username looks like an email, promote it.
 * Always mirror username ← email when email is present.
 */
export const id = 4
export const name = '004_email_identity'

export const sql = `
UPDATE profile
SET email = trim(username)
WHERE (email IS NULL OR trim(email) = '')
  AND instr(username, '@') > 1
  AND instr(username, '.') > instr(username, '@');

UPDATE profile
SET username = lower(trim(email))
WHERE email IS NOT NULL AND trim(email) != '';
`
