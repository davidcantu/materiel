import {
  FREE_PER_PLATFORM_LIMIT,
  freeTierLimitMessage,
  normalizePlatformCounts,
  platformCountsWithinFreeTier,
  platformHasFreeSlot,
  type LicenseGateDenial,
  type LicenseStatusInfo,
  type PlatformSystemCounts
} from '../../shared/license'
import type { Platform } from '../../shared/platforms'
import {
  buildRifleLimitDenial,
  canCreatePlatform,
  getLicenseStatus,
  type GetLicenseStatusOptions
} from './status'

export class LicenseLimitError extends Error {
  readonly code = 'LICENSE_RIFLE_LIMIT' as const
  readonly license: LicenseStatusInfo

  constructor(denial: LicenseGateDenial) {
    super(denial.message)
    this.name = 'LicenseLimitError'
    this.license = denial.license
  }

  toDenial(): LicenseGateDenial {
    return { code: this.code, message: this.message, license: this.license }
  }
}

export type CreateGateOptions = GetLicenseStatusOptions & {
  /** Platform of the system about to be created. */
  platform?: Platform
}

/**
 * Whether a new complete system may be created.
 * When `platform` is set, checks that platform’s free slot; otherwise any platform with room.
 */
export function canCreateCompleteSystem(options?: CreateGateOptions): boolean {
  const license = getLicenseStatus(options)
  if (!options?.platform) return license.canCreateRifle
  return canCreatePlatform(license, options.platform)
}

/**
 * Throw LicenseLimitError when free tier is exhausted for the requested platform
 * (or for every platform when none is specified) and mode is enforced.
 */
export function assertCanCreateCompleteSystem(options?: CreateGateOptions): LicenseStatusInfo {
  const license = getLicenseStatus(options)
  if (!options?.platform) {
    if (license.canCreateRifle) return license
    throw new LicenseLimitError(buildRifleLimitDenial(license))
  }
  if (canCreatePlatform(license, options.platform)) {
    return {
      ...license,
      blockReason: null
    }
  }
  const blocked: LicenseStatusInfo = {
    ...license,
    canCreateRifle: false,
    blockReason: freeTierLimitMessage(license.countsByPlatform, {
      platform: options.platform
    })
  }
  throw new LicenseLimitError(buildRifleLimitDenial(blocked, options.platform))
}

/**
 * Restore / import gate: after restore the DB would contain these per-platform counts.
 * Allowed when unlocked, paid, or every platform is within FREE_PER_PLATFORM_LIMIT.
 */
export function assertLicenseAllowsPlatformCounts(
  counts: PlatformSystemCounts,
  options?: Omit<GetLicenseStatusOptions, 'countsByPlatform' | 'completeRifleCount'>
): LicenseStatusInfo {
  const normalized = normalizePlatformCounts(counts)
  const license = getLicenseStatus({ ...options, countsByPlatform: normalized })
  if (license.mode === 'unlocked' || license.tier === 'paid') {
    return { ...license, canCreateRifle: true, blockReason: null }
  }
  if (platformCountsWithinFreeTier(normalized, FREE_PER_PLATFORM_LIMIT)) {
    return {
      ...license,
      canCreateRifle:
        platformHasFreeSlot(normalized, 'bolt_action', FREE_PER_PLATFORM_LIMIT) ||
        platformHasFreeSlot(normalized, 'ar_pattern', FREE_PER_PLATFORM_LIMIT) ||
        platformHasFreeSlot(normalized, 'pistol', FREE_PER_PLATFORM_LIMIT),
      blockReason: null
    }
  }

  const blocked: LicenseStatusInfo = {
    ...license,
    canCreateRifle: false,
    blockReason: freeTierLimitMessage(normalized, { context: 'restore' })
  }
  throw new LicenseLimitError(buildRifleLimitDenial(blocked))
}

/**
 * Restore / import gate with a total system count only (no platform breakdown).
 * Conservative: assumes all systems are the same platform, so totals above
 * FREE_PER_PLATFORM_LIMIT are blocked. Prefer assertLicenseAllowsPlatformCounts.
 */
export function assertLicenseAllowsSystemCount(
  systemCount: number,
  options?: Omit<GetLicenseStatusOptions, 'countsByPlatform' | 'completeRifleCount'>
): LicenseStatusInfo {
  const count = typeof systemCount === 'number' && systemCount > 0 ? Math.floor(systemCount) : 0
  const counts = normalizePlatformCounts({ bolt_action: count })
  try {
    return assertLicenseAllowsPlatformCounts(counts, options)
  } catch (error) {
    if (error instanceof LicenseLimitError) {
      const blocked: LicenseStatusInfo = {
        ...error.license,
        completeRifleCount: count,
        canCreateRifle: false,
        blockReason:
          `Free tier allows up to ${FREE_PER_PLATFORM_LIMIT} firearms per platform ` +
          `(restore has ${count} without platform detail; treated as one platform). ` +
          `Activate a paid license key before restoring a larger library.`
      }
      throw new LicenseLimitError(buildRifleLimitDenial(blocked))
    }
    throw error
  }
}

export function checkCreateCompleteSystem(
  options?: CreateGateOptions
): { ok: true; license: LicenseStatusInfo } | { ok: false; error: LicenseGateDenial } {
  try {
    const license = assertCanCreateCompleteSystem(options)
    return { ok: true, license }
  } catch (error) {
    if (error instanceof LicenseLimitError) {
      return { ok: false, error: error.toDenial() }
    }
    throw error
  }
}
