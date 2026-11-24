/**
 * Optional app unlock passphrase.
 *
 * When enabled, the SQLCipher key is wrapped with a scrypt-derived key and the
 * auto safeStorage key file is removed so cold start requires the passphrase.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from 'crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { UNLOCK_MIN_LENGTH } from '../../shared/unlock'
import { getDefaultKeyFilePath, type SafeStorageLike } from './key'

export type UnlockFileV1 = {
  version: 1
  salt: string
  /** AES-256-GCM: iv(12) || tag(16) || ciphertext — all hex. */
  wrappedKey: string
  /** Hex of scrypt-derived verifier mac for quick reject without unwrapping. */
  verifier: string
}

export type UnlockDeps = {
  userDataPath: string
  dbPath: string
  safeStorage?: SafeStorageLike | null
}

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 32
const VERIFIER_INFO = Buffer.from('materiel-unlock-v1', 'utf8')

function unlockPath(deps: UnlockDeps): string {
  return join(deps.userDataPath, 'materiel.unlock.json')
}

function derive(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024
  })
}

function wrapKey(dbKey: Buffer, passphrase: string): UnlockFileV1 {
  const salt = randomBytes(16)
  const material = derive(passphrase, salt)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', material, iv)
  const encrypted = Buffer.concat([cipher.update(dbKey), cipher.final()])
  const tag = cipher.getAuthTag()
  const verifier = scryptSync(Buffer.concat([material, VERIFIER_INFO]), salt, 32, {
    N: 1024,
    r: 8,
    p: 1
  })
  return {
    version: 1,
    salt: salt.toString('hex'),
    wrappedKey: Buffer.concat([iv, tag, encrypted]).toString('hex'),
    verifier: verifier.toString('hex')
  }
}

function unwrapKey(file: UnlockFileV1, passphrase: string): Buffer {
  const salt = Buffer.from(file.salt, 'hex')
  const material = derive(passphrase, salt)
  const expected = Buffer.from(file.verifier, 'hex')
  const actual = scryptSync(Buffer.concat([material, VERIFIER_INFO]), salt, 32, {
    N: 1024,
    r: 8,
    p: 1
  })
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Incorrect passphrase.')
  }

  const blob = Buffer.from(file.wrappedKey, 'hex')
  if (blob.length < 12 + 16 + 16) {
    throw new Error('Unlock file is corrupt.')
  }
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const ciphertext = blob.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', material, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function readUnlockFile(deps: UnlockDeps): UnlockFileV1 | null {
  const path = unlockPath(deps)
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as UnlockFileV1
    if (parsed?.version !== 1 || !parsed.salt || !parsed.wrappedKey || !parsed.verifier) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function isUnlockRequired(deps: UnlockDeps): boolean {
  return readUnlockFile(deps) !== null
}

export function assertPassphraseStrength(passphrase: string): void {
  if (typeof passphrase !== 'string' || passphrase.length < UNLOCK_MIN_LENGTH) {
    throw new Error(`Passphrase must be at least ${UNLOCK_MIN_LENGTH} characters.`)
  }
}

function removeAutoKeyFiles(dbPath: string): void {
  const keyPath = getDefaultKeyFilePath(dbPath)
  const devPath = `${keyPath}.dev`
  for (const path of [keyPath, devPath]) {
    if (existsSync(path)) {
      unlinkSync(path)
    }
  }
}

function writeUnlockFile(deps: UnlockDeps, file: UnlockFileV1): void {
  const path = unlockPath(deps)
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 })
  renameSync(tmp, path)
}

function deleteUnlockFile(deps: UnlockDeps): void {
  const path = unlockPath(deps)
  if (existsSync(path)) unlinkSync(path)
}

export function enableUnlock(
  passphrase: string,
  confirm: string,
  dbKey: Buffer,
  deps: UnlockDeps
): void {
  assertPassphraseStrength(passphrase)
  if (passphrase !== confirm) {
    throw new Error('Passphrase confirmation does not match.')
  }
  if (readUnlockFile(deps)) {
    throw new Error('Unlock passphrase is already enabled.')
  }
  if (!Buffer.isBuffer(dbKey) || dbKey.length < 16) {
    throw new Error('Database key is unavailable in this session.')
  }
  writeUnlockFile(deps, wrapKey(dbKey, passphrase))
  removeAutoKeyFiles(deps.dbPath)
}

export function changeUnlockPassphrase(
  currentPassphrase: string,
  nextPassphrase: string,
  confirm: string,
  deps: UnlockDeps
): void {
  assertPassphraseStrength(nextPassphrase)
  if (nextPassphrase !== confirm) {
    throw new Error('Passphrase confirmation does not match.')
  }
  const existing = readUnlockFile(deps)
  if (!existing) {
    throw new Error('Unlock passphrase is not enabled.')
  }
  const dbKey = unwrapKey(existing, currentPassphrase)
  writeUnlockFile(deps, wrapKey(dbKey, nextPassphrase))
}

export function disableUnlock(passphrase: string, deps: UnlockDeps): void {
  const existing = readUnlockFile(deps)
  if (!existing) {
    throw new Error('Unlock passphrase is not enabled.')
  }
  const dbKey = unwrapKey(existing, passphrase)
  // Restore auto-unlock via safeStorage when available.
  const keyPath = getDefaultKeyFilePath(deps.dbPath)
  mkdirSync(dirname(keyPath), { recursive: true })
  if (deps.safeStorage?.isEncryptionAvailable()) {
    const encrypted = deps.safeStorage.encryptString(dbKey.toString('hex'))
    writeFileSync(keyPath, encrypted, { mode: 0o600 })
  } else {
    writeFileSync(`${keyPath}.dev`, dbKey.toString('hex'), { mode: 0o600 })
  }
  deleteUnlockFile(deps)
}

export function unlockWithPassphrase(passphrase: string, deps: UnlockDeps): Buffer {
  const existing = readUnlockFile(deps)
  if (!existing) {
    throw new Error('Unlock passphrase is not configured.')
  }
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new Error('Enter your unlock passphrase.')
  }
  return unwrapKey(existing, passphrase)
}
