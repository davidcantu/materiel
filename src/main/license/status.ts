import { countCompleteSystemsByPlatform } from '../db/systems'
import { requireDatabase } from '../db/connection'
import {
  anyPlatformHasFreeSlot,
  emptyPlatformCounts,
  FREE_PER_PLATFORM_LIMIT,
  freeTierLimitMessage,
  normalizePlatformCounts,
  platformHasFreeSlot,
  totalPlatformCounts,
  type LicenseStatusInfo,
  type PlatformSystemCounts
} from '../../shared/license'
import type { Platform } from '../../shared/platforms'
import { resolveLicenseMode } from './mode'
import { loadStoredLicense, type LicenseStoreOptions } from './store'
import { ensureLicenseState, readLicenseState } from './state'
import { verifyLicenseKey, resolveSigningSecret } from './crypto'

export type GetLicenseStatusOptions = LicenseStoreOptions & {
  /** Override per-platform counts (tests). */
  countsByPlatform?: PlatformSystemCounts
  /**
   * @deprecated Prefer countsByPlatform. When set alone, treated as a single-platform
   * worst-case total for restore compatibility (all systems counted as bolt_action).
   */
  completeRifleCount?: number
  /** Skip DB (tests that only exercise store + mode). */
  skipDb?: boolean
}

export function getLicenseStatus(options: GetLicenseStatusOptions = {}): LicenseStatusInfo {
  const mode = resolveLicenseMode()
  const stored = loadStoredLicense(options)

  let keyPresent = Boolean(stored)
  let activatedEmail: string | null = stored?.email ?? null
  let activatedUsername: string | null = stored?.username?.trim() || null
  let tier: LicenseStatusInfo['tier'] = 'free'

  if (stored) {
    const secret = resolveSigningSecret()
    const verified = verifyLicenseKey(stored.key, {
      secret,
      claimedEmail: stored.email
    })
    if (verified.ok) {
      tier = 'paid'
      keyPresent = true
      activatedEmail = verified.email
      activatedUsername = stored.username?.trim() || null
    } else {
      // Corrupt / wrong-secret key on disk — treat as free.
      keyPresent = false
      activatedEmail = null
      activatedUsername = null
      tier = 'free'
    }
  }

  if (!options.skipDb) {
    try {
      const db = requireDatabase().db
      ensureLicenseState(db)
      readLicenseState(db)
    } catch {
      // DB not open (unit tests without connection).
    }
  }

  const countsByPlatform = resolveCounts(options)
  const completeRifleCount = totalPlatformCounts(countsByPlatform)
  const withinFreeTier = anyPlatformHasFreeSlot(countsByPlatform, FREE_PER_PLATFORM_LIMIT)
  const canCreateRifle = mode === 'unlocked' || tier === 'paid' || withinFreeTier

  let blockReason: string | null = null
  if (!canCreateRifle) {
    blockReason = freeTierLimitMessage(countsByPlatform)
  }

  return {
    tier,
    freeRifleLimit: FREE_PER_PLATFORM_LIMIT,
    completeRifleCount,
    countsByPlatform,
    canCreateRifle,
    keyPresent,
    activatedEmail,
    activatedUsername,
    mode,
    blockReason
  }
}

function resolveCounts(options: GetLicenseStatusOptions): PlatformSystemCounts {
  if (options.countsByPlatform) {
    return normalizePlatformCounts(options.countsByPlatform)
  }
  if (typeof options.completeRifleCount === 'number') {
    // Legacy override: attribute the whole count to bolt_action (worst-case for restore).
    const counts = emptyPlatformCounts()
    counts.bolt_action = Math.max(0, Math.floor(options.completeRifleCount))
    return counts
  }
  try {
    return countCompleteSystemsByPlatform(requireDatabase().db)
  } catch {
    return emptyPlatformCounts()
  }
}

export function canCreatePlatform(license: LicenseStatusInfo, platform: Platform): boolean {
  if (license.mode === 'unlocked' || license.tier === 'paid') return true
  return platformHasFreeSlot(license.countsByPlatform, platform, license.freeRifleLimit)
}

export function buildRifleLimitDenial(
  license: LicenseStatusInfo,
  platform?: Platform
): {
  code: 'LICENSE_RIFLE_LIMIT'
  message: string
  license: LicenseStatusInfo
} {
  return {
    code: 'LICENSE_RIFLE_LIMIT',
    message:
      license.blockReason ??
      freeTierLimitMessage(license.countsByPlatform, platform ? { platform } : undefined),
    license
  }
}
