import { countCompleteSystems } from '../db/systems'
import { requireDatabase } from '../db/connection'
import type { LicenseStatusInfo } from '../../shared/license'
import { FREE_RIFLE_LIMIT } from './crypto'
import { resolveLicenseMode } from './mode'
import { loadStoredLicense, type LicenseStoreOptions } from './store'
import { ensureLicenseState, readLicenseState } from './state'
import { verifyLicenseKey, resolveSigningSecret } from './crypto'

export type GetLicenseStatusOptions = LicenseStoreOptions & {
  /** Override system count (tests). */
  completeRifleCount?: number
  /** Skip DB (tests that only exercise store + mode). */
  skipDb?: boolean
}

function rifleLimitMessage(count: number): string {
  return (
    `Free tier allows up to ${FREE_RIFLE_LIMIT} complete rifle systems ` +
    `(you have ${count}). Activate a paid license key to add more.`
  )
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

  const completeRifleCount =
    options.completeRifleCount ??
    (() => {
      try {
        return countCompleteSystems(requireDatabase().db)
      } catch {
        return 0
      }
    })()

  const withinFreeTier = completeRifleCount < FREE_RIFLE_LIMIT
  const canCreateRifle = mode === 'unlocked' || tier === 'paid' || withinFreeTier

  let blockReason: string | null = null
  if (!canCreateRifle) {
    blockReason = rifleLimitMessage(completeRifleCount)
  }

  return {
    tier,
    freeRifleLimit: FREE_RIFLE_LIMIT,
    completeRifleCount,
    canCreateRifle,
    keyPresent,
    activatedEmail,
    activatedUsername,
    mode,
    blockReason
  }
}

export function buildRifleLimitDenial(license: LicenseStatusInfo): {
  code: 'LICENSE_RIFLE_LIMIT'
  message: string
  license: LicenseStatusInfo
} {
  return {
    code: 'LICENSE_RIFLE_LIMIT',
    message: license.blockReason ?? rifleLimitMessage(license.completeRifleCount),
    license
  }
}
