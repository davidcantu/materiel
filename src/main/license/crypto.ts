/**
 * Offline license key issue + verify (Ed25519).
 *
 * Key format: MAT-1.<emailB64url>.<sigB64url>
 * (dots — base64url never contains `.`)
 * Canonical message: `v1|<normalizedEmail>`
 *
 * - Issue (operator CLI): Ed25519 private key via LICENSE_SIGNING_PRIVATE_KEY
 * - Verify (desktop app): embedded public key only — never ship the private key
 *
 * See docs/license.md and `npm run license:keypair`.
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject
} from 'crypto'
import { FREE_PER_PLATFORM_LIMIT, FREE_RIFLE_LIMIT, LICENSE_KEY_PREFIX } from '../../shared/license'
import { getMaterielLicensePublicKey } from './public-key'

export { FREE_PER_PLATFORM_LIMIT, FREE_RIFLE_LIMIT, LICENSE_KEY_PREFIX }
export { getMaterielLicensePublicKey, MATERIEL_LICENSE_PUBLIC_KEY_SPKI_B64 } from './public-key'

/** Ed25519 signatures are 64 bytes. */
export const LICENSE_SIGNATURE_BYTES = 64

export type LicenseKeyInput = KeyObject | string | Buffer

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

function canonicalMessage(email: string): string {
  return `v1|${normalizeEmail(email)}`
}

/**
 * Parse a PKCS8 PEM/DER private key or SPKI PEM/DER public key.
 * PEM is detected by "BEGIN"; otherwise treated as base64 DER or raw DER Buffer.
 */
export function parsePrivateKey(material: LicenseKeyInput): KeyObject {
  if (typeof material !== 'string' && !Buffer.isBuffer(material)) {
    if (material.type !== 'private') {
      throw new Error('Expected an Ed25519 private KeyObject')
    }
    return material
  }
  const text = Buffer.isBuffer(material) ? material.toString('utf8') : material.trim()
  if (text.includes('BEGIN')) {
    return createPrivateKey(text)
  }
  const der = Buffer.isBuffer(material)
    ? material
    : Buffer.from(text.replace(/\s+/g, ''), 'base64')
  return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
}

export function parsePublicKey(material: LicenseKeyInput): KeyObject {
  if (typeof material !== 'string' && !Buffer.isBuffer(material)) {
    if (material.type !== 'public') {
      throw new Error('Expected an Ed25519 public KeyObject')
    }
    return material
  }
  const text = Buffer.isBuffer(material) ? material.toString('utf8') : material.trim()
  if (text.includes('BEGIN')) {
    return createPublicKey(text)
  }
  const der = Buffer.isBuffer(material)
    ? material
    : Buffer.from(text.replace(/\s+/g, ''), 'base64')
  return createPublicKey({ key: der, format: 'der', type: 'spki' })
}

/** Load issuer private key from env (PEM or base64 PKCS8 DER). */
export function resolveSigningPrivateKey(env: NodeJS.ProcessEnv = process.env): KeyObject | null {
  const raw = env.LICENSE_SIGNING_PRIVATE_KEY?.trim()
  if (!raw) return null
  try {
    return parsePrivateKey(raw)
  } catch {
    return null
  }
}

/**
 * Issue a paid license key bound to an email (Ed25519 over canonical message).
 */
export function issueLicenseKey(email: string, privateKey: LicenseKeyInput): string {
  const normalized = normalizeEmail(email)
  if (!isValidEmailShape(normalized)) {
    throw new Error(`Invalid email: ${email}`)
  }
  const keyObj = parsePrivateKey(privateKey)
  const emailPart = base64UrlEncode(normalized)
  const sig = cryptoSign(null, Buffer.from(canonicalMessage(normalized), 'utf8'), keyObj)
  if (sig.length !== LICENSE_SIGNATURE_BYTES) {
    throw new Error(`Unexpected Ed25519 signature length: ${sig.length}`)
  }
  return `${LICENSE_KEY_PREFIX}${emailPart}.${base64UrlEncode(sig)}`
}

export type VerifiedLicenseKey = {
  email: string
  key: string
}

export type VerifyLicenseKeyResult =
  | { ok: true; email: string; key: string }
  | { ok: false; reason: 'format' | 'email' | 'signature' }

/**
 * Parse MAT-1.<emailB64>.<sigB64> without verifying the signature.
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
    return (
      isValidEmailShape(email) &&
      base64UrlDecodeToBuffer(parsed.sigB64).length === LICENSE_SIGNATURE_BYTES
    )
  } catch {
    return false
  }
}

/**
 * Verify key signature with the embedded (or injected) Ed25519 public key.
 * When `claimedEmail` is set, it must match the email embedded in the key.
 */
export function verifyLicenseKey(
  key: string,
  options: { publicKey?: LicenseKeyInput | null; claimedEmail?: string } = {}
): VerifyLicenseKeyResult {
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

  if (!isValidEmailShape(embeddedEmail) || sig.length !== LICENSE_SIGNATURE_BYTES) {
    return { ok: false, reason: 'format' }
  }

  if (options.claimedEmail !== undefined) {
    if (normalizeEmail(options.claimedEmail) !== embeddedEmail) {
      return { ok: false, reason: 'email' }
    }
  }

  const publicKey =
    options.publicKey === undefined || options.publicKey === null
      ? getMaterielLicensePublicKey()
      : parsePublicKey(options.publicKey)

  const ok = cryptoVerify(
    null,
    Buffer.from(canonicalMessage(embeddedEmail), 'utf8'),
    publicKey,
    sig
  )
  if (!ok) {
    return { ok: false, reason: 'signature' }
  }

  return { ok: true, email: embeddedEmail, key: key.trim() }
}

/** Fingerprint safe for DB / diagnostics (never the raw key). */
export function licenseKeyFingerprint(key: string): string {
  return createHash('sha256').update(key.trim(), 'utf8').digest('hex').slice(0, 16)
}
