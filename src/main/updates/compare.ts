/**
 * Lightweight semver-ish compare for GitHub release tags vs app.getVersion().
 * Handles optional leading "v", ignores pre-release / build metadata for ordering.
 */

export function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, '')
}

/** Numeric core segments only (e.g. "1.2.3-beta.1+build" → [1, 2, 3]). */
export function parseVersionCore(raw: string): number[] | null {
  const core = normalizeVersion(raw).split(/[-+]/)[0]?.trim()
  if (!core) return null
  const parts = core.split('.')
  if (parts.length === 0 || parts.some((p) => p === '' || !/^\d+$/.test(p))) {
    return null
  }
  return parts.map((p) => Number.parseInt(p, 10))
}

/** True when `latest` is strictly newer than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersionCore(latest)
  const b = parseVersionCore(current)
  if (!a || !b) return false
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}
