/**
 * App-wide constants that are safe to change without hunting through UI copy.
 */

/** Public download page — update when packaging moves off GitHub Releases. */
export const MATERIEL_DOWNLOAD_URL = 'https://github.com/davidcantu/materiel/releases'

/** Repo used by the soft update checker (GitHub Releases API). */
export const MATERIEL_GITHUB_OWNER = 'davidcantu'
export const MATERIEL_GITHUB_REPO = 'materiel'

export const SHARE_EMAIL_SUBJECT = 'Check out Materiel — local firearms inventory & logs'

export const SHARE_EMAIL_BODY = [
  'Hey —',
  '',
  'I found Materiel: a local-first desktop firearms tracker.',
  'Inventory and builds, session logs, ammo, maintenance alerts, and encrypted data on your machine.',
  'This is cool — worth a look.',
  '',
  `Download: ${MATERIEL_DOWNLOAD_URL}`,
  '',
  '— sent from Materiel'
].join('\n')

/** Build a mailto: URL for the Share via email CTA (empty To: so the user picks recipients). */
export function buildShareMailto(options?: { to?: string }): string {
  const to = options?.to?.trim() ?? ''
  const subject = encodeURIComponent(SHARE_EMAIL_SUBJECT)
  const body = encodeURIComponent(SHARE_EMAIL_BODY)
  return `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`
}
