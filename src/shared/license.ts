import { PLATFORM_LABELS, PLATFORMS, type Platform } from './platforms'

/** Free tier: max complete systems per platform (bolt / pistol / AR) without a paid key. */
export const FREE_PER_PLATFORM_LIMIT = 2

/**
 * @deprecated Alias of FREE_PER_PLATFORM_LIMIT (per-platform, not total).
 * Kept so older imports keep compiling.
 */
export const FREE_RIFLE_LIMIT = FREE_PER_PLATFORM_LIMIT

/** Human-facing prefix; full keys look like `MAT-1.<emailB64>.<sigB64>`. */
export const LICENSE_KEY_PREFIX = 'MAT-1.'

export type LicenseTier = 'free' | 'paid'

export type LicenseMode = 'unlocked' | 'enforced'

/** Complete-system counts keyed by platform. */
export type PlatformSystemCounts = Record<Platform, number>

export function emptyPlatformCounts(): PlatformSystemCounts {
  return { bolt_action: 0, ar_pattern: 0, pistol: 0 }
}

export function totalPlatformCounts(counts: PlatformSystemCounts): number {
  return PLATFORMS.reduce((sum, platform) => sum + (counts[platform] ?? 0), 0)
}

export function normalizePlatformCounts(
  raw?: Partial<PlatformSystemCounts> | null
): PlatformSystemCounts {
  const next = emptyPlatformCounts()
  if (!raw) return next
  for (const platform of PLATFORMS) {
    const value = raw[platform]
    next[platform] = typeof value === 'number' && value > 0 ? Math.floor(value) : 0
  }
  return next
}

/** True when this platform still has a free slot (count strictly below the limit). */
export function platformHasFreeSlot(
  counts: PlatformSystemCounts,
  platform: Platform,
  limit: number = FREE_PER_PLATFORM_LIMIT
): boolean {
  return (counts[platform] ?? 0) < limit
}

/** True when every platform is within the free per-platform cap (inclusive). */
export function platformCountsWithinFreeTier(
  counts: PlatformSystemCounts,
  limit: number = FREE_PER_PLATFORM_LIMIT
): boolean {
  return PLATFORMS.every((platform) => (counts[platform] ?? 0) <= limit)
}

/** True when at least one platform still has room under the free cap. */
export function anyPlatformHasFreeSlot(
  counts: PlatformSystemCounts,
  limit: number = FREE_PER_PLATFORM_LIMIT
): boolean {
  return PLATFORMS.some((platform) => platformHasFreeSlot(counts, platform, limit))
}

export function platformsAtLimit(
  counts: PlatformSystemCounts,
  limit: number = FREE_PER_PLATFORM_LIMIT
): Platform[] {
  return PLATFORMS.filter((platform) => (counts[platform] ?? 0) >= limit)
}

export function formatPlatformCountsSummary(
  counts: PlatformSystemCounts,
  limit: number = FREE_PER_PLATFORM_LIMIT
): string {
  return PLATFORMS.map(
    (platform) => `${PLATFORM_LABELS[platform]} ${counts[platform] ?? 0}/${limit}`
  ).join(' · ')
}

export function freeTierLimitMessage(
  counts: PlatformSystemCounts,
  options?: { platform?: Platform; context?: 'create' | 'restore' }
): string {
  const limit = FREE_PER_PLATFORM_LIMIT
  const summary = formatPlatformCountsSummary(counts, limit)
  if (options?.platform) {
    const label = PLATFORM_LABELS[options.platform]
    const have = counts[options.platform] ?? 0
    return (
      `Free tier allows up to ${limit} ${label} firearms ` +
      `(you have ${have}). Activate a paid license key to add more. ` +
      `Usage: ${summary}.`
    )
  }
  if (options?.context === 'restore') {
    return (
      `Free tier allows up to ${limit} firearms per platform ` +
      `(bolt, pistol, AR). Restore would exceed that (${summary}). ` +
      `Activate a paid license key before restoring a larger library.`
    )
  }
  return (
    `Free tier allows up to ${limit} firearms per platform ` +
    `(bolt, pistol, AR). Usage: ${summary}. Activate a paid license key to add more.`
  )
}

export type LicenseStatusInfo = {
  tier: LicenseTier
  /** Max free complete systems per platform. */
  freeRifleLimit: number
  /** Total complete systems across all platforms. */
  completeRifleCount: number
  /** Per-platform complete-system counts. */
  countsByPlatform: PlatformSystemCounts
  /**
   * True when paid/unlocked, or when at least one platform is still under the free cap.
   * Create paths must also check the specific platform via the gate.
   */
  canCreateRifle: boolean
  keyPresent: boolean
  activatedEmail: string | null
  /**
   * Identity stored with the activated key (always the license email).
   * Kept for compatibility with older license.dat payloads that had a separate username.
   */
  activatedUsername: string | null
  mode: LicenseMode
  /** Present when create/restore would be blocked under enforced free tier. */
  blockReason: string | null
}

export type LicenseActivateRequest = {
  email: string
  key: string
  /**
   * @deprecated Email is the username. Ignored when present; kept for older clients.
   */
  username?: string
}

export type LicenseActivateResult =
  | { ok: true; license: LicenseStatusInfo }
  | { ok: false; code: LicenseErrorCode; message: string; license: LicenseStatusInfo }

export type LicenseErrorCode =
  | 'LICENSE_RIFLE_LIMIT'
  | 'LICENSE_INVALID_KEY'
  | 'LICENSE_EMAIL_MISMATCH'
  /** @deprecated Email is the username; no longer returned. */
  | 'LICENSE_USERNAME_REQUIRED'
  /** @deprecated Email is the username; no longer returned. */
  | 'LICENSE_USERNAME_MISMATCH'
  | 'LICENSE_SECRET_MISSING'
  | 'LICENSE_STORAGE_UNAVAILABLE'
  | 'LICENSE_NOT_ACTIVATED'

export type LicenseGateDenial = {
  code: 'LICENSE_RIFLE_LIMIT'
  message: string
  license: LicenseStatusInfo
}

export type GatedCreateResult<T> = { ok: true; system: T } | { ok: false; error: LicenseGateDenial }
