import type { LicenseActivateResult } from '../../shared/license'
import { isValidEmailShape, normalizeEmail, resolveSigningSecret, verifyLicenseKey } from './crypto'
import { markLicenseActivated, markLicenseCleared } from './state'
import { clearStoredLicense, saveStoredLicense, type LicenseStoreOptions } from './store'
import { getLicenseStatus } from './status'

export type ActivateOptions = LicenseStoreOptions

export function activateLicense(
  input: { email: string; key: string },
  options: ActivateOptions = {}
): LicenseActivateResult {
  const email = normalizeEmail(input.email)
  const key = input.key.trim()
  const license = (): ReturnType<typeof getLicenseStatus> => getLicenseStatus(options)

  if (!isValidEmailShape(email)) {
    return {
      ok: false,
      code: 'LICENSE_INVALID_KEY',
      message: 'Enter a valid email address bound to your license key.',
      license: license()
    }
  }

  const secret = resolveSigningSecret()
  if (!secret) {
    return {
      ok: false,
      code: 'LICENSE_SECRET_MISSING',
      message:
        'License verification is not configured (missing LICENSE_SIGNING_SECRET / MAIN_VITE_LICENSE_SIGNING_SECRET).',
      license: license()
    }
  }

  const verified = verifyLicenseKey(key, { secret, claimedEmail: email })
  if (!verified.ok) {
    if (verified.reason === 'email') {
      return {
        ok: false,
        code: 'LICENSE_EMAIL_MISMATCH',
        message: 'This license key was issued for a different email address.',
        license: license()
      }
    }
    if (verified.reason === 'format' || verified.reason === 'signature') {
      return {
        ok: false,
        code: 'LICENSE_INVALID_KEY',
        message: 'Invalid license key. Check the key and try again.',
        license: license()
      }
    }
    return {
      ok: false,
      code: 'LICENSE_SECRET_MISSING',
      message: 'License verification is not configured.',
      license: license()
    }
  }

  const activatedAt = new Date().toISOString()
  try {
    saveStoredLicense({ email: verified.email, key: verified.key, activatedAt }, options)
  } catch (error) {
    return {
      ok: false,
      code: 'LICENSE_STORAGE_UNAVAILABLE',
      message:
        error instanceof Error ? error.message : 'Could not store the license key on this device.',
      license: license()
    }
  }

  try {
    markLicenseActivated({ email: verified.email, key: verified.key, activatedAt })
  } catch {
    // Store succeeded; DB sync is best-effort when DB is unavailable in tests.
  }

  return { ok: true, license: license() }
}

export function clearLicense(options: ActivateOptions = {}): ReturnType<typeof getLicenseStatus> {
  clearStoredLicense(options)
  try {
    markLicenseCleared()
  } catch {
    // ignore when DB closed
  }
  return getLicenseStatus(options)
}
