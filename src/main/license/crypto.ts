/**
 * Offline license key issue + verify (HMAC-SHA256).
 *
 * Key format: MAT-1.<emailB64url>.<sigB64url>
 * (dots — base64url never contains `.`)
 * Canonical message: `v1|<normalizedEmail>`
 *
 * Signing secret comes from env (never commit production secrets):
 * - Issuer CLI: LICENSE_SIGNING_SECRET
 * - Electron app: MAIN_VITE_LICENSE_SIGNING_SECRET or LICENSE_SIGNING_SECRET
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { FREE_RIFLE_LIMIT, LICENSE_KEY_PREFIX } from '../../shared/license'

export { FREE_RIFLE_LIMIT, LICENSE_KEY_PREFIX }

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmailShape(email: string): boolean {
  // Practical shape check — not full RFC. Requires one @ and a dot in the domain.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))
}

function base64UrlEncode(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf
  return b.toString('base64url')
}

function base64UrlDecodeToString(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function base64UrlDecodeToBuffer(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

export function resolveSigningSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret =
    env.LICENSE_SIGNING_SECRET?.trim() || env.MAIN_VITE_LICENSE_SIGNING_SECRET?.trim() || ''
  return secret.length > 0 ? secret : null
}

function canonicalMessage(email: string): string {
  return `v1|${normalizeEmail(email)}`
}

function sign(email: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(canonicalMessage(email), 'utf8').digest()
}

/**
 * Issue a paid license key bound to an email.
 * Throws if email is invalid or secret is missing.
 */
export function issueLicenseKey(email: string, secret: string): string {
  const normalized = normalizeEmail(email)
  if (!isValidEmailShape(normalized)) {
    throw new Error(`Invalid email: ${email}`)
  }
  if (!secret) {
    throw new Error('LICENSE_SIGNING_SECRET is required to issue a key')
  }
  const emailPart = base64UrlEncode(normalized)
  const sigPart = base64UrlEncode(sign(normalized, secret))
  return `${LICENSE_KEY_PREFIX}${emailPart}.${sigPart}`
}

export type VerifiedLicenseKey = {
  email: string
  key: string
}

export type VerifyLicenseKeyResult =
  | { ok: true; email: string; key: string }
  | { ok: false; reason: 'format' | 'email' | 'signature' | 'secret' }

/**
 * Parse MAT-1.<emailB64>.<sigB64> without verifying the HMAC.
 */
export function parseLicenseKey(key: string): { emailB64: string; sigB64: string } | null {
  const trimmed = key.trim()
  if (!trimmed.startsWith(LICENSE_KEY_PREFIX)) return null
  const rest = trimmed.slice(LICENSE_KEY_PREFIX.length)
  const parts = rest.split('.')
  if (parts.length !== 2) return null
  const [emailB64, sigB64] = parts
  if (!emailB64 || !sigB64) return null
  if (!/^[A-Za-z0-9_-]+$/.test(emailB64) || !/^[A-Za-z0-9_-]+$/.test(sigB64)) return null
  return { emailB64, sigB64 }
}

export function validateLicenseKeyFormat(key: string): boolean {
  const parsed = parseLicenseKey(key)
  if (!parsed) return false
  try {
    const email = base64UrlDecodeToString(parsed.emailB64)
    return isValidEmailShape(email) && base64UrlDecodeToBuffer(parsed.sigB64).length === 32
  } catch {
    return false
  }
}

/**
 * Verify key signature and optional claimed email.
 * When `claimedEmail` is set, it must match the email embedded in the key.
 */
export function verifyLicenseKey(
  key: string,
  options: { secret?: string | null; claimedEmail?: string } = {}
): VerifyLicenseKeyResult {
  const secret = options.secret === undefined ? resolveSigningSecret() : options.secret
  if (!secret) {
    return { ok: false, reason: 'secret' }
  }

  const parsed = parseLicenseKey(key)
  if (!parsed) {
    return { ok: false, reason: 'format' }
  }

  let embeddedEmail: string
  let sig: Buffer
  try {
    embeddedEmail = normalizeEmail(base64UrlDecodeToString(parsed.emailB64))
    sig = base64UrlDecodeToBuffer(parsed.sigB64)
  } catch {
    return { ok: false, reason: 'format' }
  }

  if (!isValidEmailShape(embeddedEmail) || sig.length !== 32) {
    return { ok: false, reason: 'format' }
  }

  if (options.claimedEmail !== undefined) {
    if (normalizeEmail(options.claimedEmail) !== embeddedEmail) {
      return { ok: false, reason: 'email' }
    }
  }

  const expected = sign(embeddedEmail, secret)
  if (expected.length !== sig.length || !timingSafeEqual(expected, sig)) {
    return { ok: false, reason: 'signature' }
  }

  return { ok: true, email: embeddedEmail, key: key.trim() }
}

/** Fingerprint safe for DB / diagnostics (never the raw key). */
export function licenseKeyFingerprint(key: string): string {
  return createHmac('sha256', 'materiel-license-fingerprint')
    .update(key.trim(), 'utf8')
    .digest('hex')
    .slice(0, 16)
}
