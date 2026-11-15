import type { LicenseGateDenial, LicenseStatusInfo } from '../../shared/license'
import { buildRifleLimitDenial, getLicenseStatus, type GetLicenseStatusOptions } from './status'

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

/**
 * Whether a new complete system may be created (current count + 1).
 */
export function canCreateCompleteSystem(options?: GetLicenseStatusOptions): boolean {
  return getLicenseStatus(options).canCreateRifle
}

/**
 * Throw LicenseLimitError when free tier is exhausted and mode is enforced.
 */
export function assertCanCreateCompleteSystem(
  options?: GetLicenseStatusOptions
): LicenseStatusInfo {
  const license = getLicenseStatus(options)
  if (license.canCreateRifle) return license
  throw new LicenseLimitError(buildRifleLimitDenial(license))
}

/**
 * Restore / import gate: after restore the DB would contain `systemCount` systems.
 * Allowed when unlocked, paid, or systemCount <= FREE_RIFLE_LIMIT.
 */
export function assertLicenseAllowsSystemCount(
  systemCount: number,
  options?: Omit<GetLicenseStatusOptions, 'completeRifleCount'>
): LicenseStatusInfo {
  const license = getLicenseStatus({ ...options, completeRifleCount: systemCount })
  if (license.mode === 'unlocked' || license.tier === 'paid') {
    return { ...license, canCreateRifle: true, blockReason: null }
  }
  if (systemCount <= license.freeRifleLimit) {
    return {
      ...license,
      canCreateRifle: systemCount < license.freeRifleLimit,
      blockReason: null
    }
  }

  const blocked: LicenseStatusInfo = {
    ...license,
    canCreateRifle: false,
    blockReason:
      `Free tier allows up to ${license.freeRifleLimit} complete firearms ` +
      `(restore has ${systemCount}). Activate a paid license key before restoring a larger library.`
  }
  throw new LicenseLimitError(buildRifleLimitDenial(blocked))
}

export function checkCreateCompleteSystem(
  options?: GetLicenseStatusOptions
): { ok: true; license: LicenseStatusInfo } | { ok: false; error: LicenseGateDenial } {
  const license = getLicenseStatus(options)
  if (license.canCreateRifle) return { ok: true, license }
  return { ok: false, error: buildRifleLimitDenial(license) }
}
