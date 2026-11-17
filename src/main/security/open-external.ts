/**
 * Allowlisted shell.openExternal — never open arbitrary URLs from the renderer
 * or from soft-update / OAuth flows.
 */

import { shell } from 'electron'

const MATERIEL_GITHUB_PREFIX = '/davidcantu/materiel'

/** Hosts allowed for https: navigation via openExternal. */
const ALLOWED_HTTPS_HOSTS = new Set([
  'github.com',
  'accounts.google.com',
  'login.microsoftonline.com'
])

export type SafeOpenExternalResult =
  | { ok: true }
  | { ok: false; reason: 'invalid-url' | 'denied' }

/**
 * Whether Materiel may open this URL in the system handler.
 * Allows: mailto:; https GitHub materiel repo paths; Google/Microsoft OAuth hosts.
 */
export function isAllowedExternalUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }

  if (url.protocol === 'mailto:') {
    return true
  }

  if (url.protocol !== 'https:') {
    return false
  }

  const host = url.hostname.toLowerCase()
  if (!ALLOWED_HTTPS_HOSTS.has(host)) {
    return false
  }

  if (host === 'github.com') {
    const path = url.pathname.replace(/\/+$/, '') || '/'
    return path === MATERIEL_GITHUB_PREFIX || path.startsWith(`${MATERIEL_GITHUB_PREFIX}/`)
  }

  // OAuth authorize hosts — any path under the known host (query carries client_id).
  return true
}

export function evaluateExternalUrl(raw: string): SafeOpenExternalResult {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, reason: 'invalid-url' }
  }
  try {
    // eslint-disable-next-line no-new
    new URL(raw)
  } catch {
    return { ok: false, reason: 'invalid-url' }
  }
  if (!isAllowedExternalUrl(raw)) {
    return { ok: false, reason: 'denied' }
  }
  return { ok: true }
}

/**
 * Open only allowlisted URLs. Rejects silently to the caller via thrown Error
 * so OAuth / update flows can surface a clear failure.
 */
export async function safeOpenExternal(
  raw: string,
  open: (url: string) => Promise<void> = (url) => shell.openExternal(url)
): Promise<void> {
  const verdict = evaluateExternalUrl(raw)
  if (!verdict.ok) {
    throw new Error(
      verdict.reason === 'invalid-url'
        ? 'Cannot open link: invalid URL'
        : 'Cannot open link: URL is not on the Materiel allowlist'
    )
  }
  await open(raw)
}
