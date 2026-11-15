/** Free tier: max complete rifle systems without a paid license key. */
export const FREE_RIFLE_LIMIT = 2

/** Human-facing prefix; full keys look like `MAT-1.<emailB64>.<sigB64>`. */
export const LICENSE_KEY_PREFIX = 'MAT-1.'

export type LicenseTier = 'free' | 'paid'

export type LicenseMode = 'unlocked' | 'enforced'

export type LicenseStatusInfo = {
  tier: LicenseTier
  freeRifleLimit: number
  completeRifleCount: number
  canCreateRifle: boolean
  keyPresent: boolean
  activatedEmail: string | null
  mode: LicenseMode
  /** Present when create/restore would be blocked under enforced free tier. */
  blockReason: string | null
}

export type LicenseActivateRequest = {
  email: string
  key: string
}

export type LicenseActivateResult =
  | { ok: true; license: LicenseStatusInfo }
  | { ok: false; code: LicenseErrorCode; message: string; license: LicenseStatusInfo }

export type LicenseErrorCode =
  | 'LICENSE_RIFLE_LIMIT'
  | 'LICENSE_INVALID_KEY'
  | 'LICENSE_EMAIL_MISMATCH'
  | 'LICENSE_SECRET_MISSING'
  | 'LICENSE_STORAGE_UNAVAILABLE'
  | 'LICENSE_NOT_ACTIVATED'

export type LicenseGateDenial = {
  code: 'LICENSE_RIFLE_LIMIT'
  message: string
  license: LicenseStatusInfo
}

export type GatedCreateResult<T> = { ok: true; system: T } | { ok: false; error: LicenseGateDenial }
