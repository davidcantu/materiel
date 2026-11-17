/**
 * Database encryption key resolution.
 *
 * Default (local-first): a random 32-byte key is generated on first open and
 * persisted encrypted via Electron `safeStorage` (OS keychain / DPAPI).
 * The app unlocks automatically when the OS user session can decrypt that blob.
 *
 * Optional: pass `passphrase` (user-chosen) or `key` (explicit Buffer/string)
 * to openDatabase — useful for shared-device unlock PIN/passphrase flows and tests.
 *
 * See docs/database.md for the full contract.
 */

import { createHash, randomBytes } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { isProductionAppEnv } from '../env'

export const DB_CIPHER = 'sqlcipher' as const
export const KEY_FILE_SUFFIX = '.key'

export type ResolvedKey = {
  /** Raw key material applied via db.key(Buffer) */
  key: Buffer
  /** How the key was obtained */
  source: 'safeStorage' | 'passphrase' | 'explicit' | 'env' | 'dev-file'
}

export type ResolveKeyOptions = {
  /** Absolute path to the .db file (key file lives beside it by default). */
  dbPath: string
  /** Explicit binary or string key (tests / advanced). */
  key?: string | Buffer
  /** User passphrase; hashed to 32 bytes with SHA-256. */
  passphrase?: string
  /**
   * Electron safeStorage-like encrypt/decrypt. Injected so tests can stub it.
   * When omitted, init tries to load electron.safeStorage if available.
   */
  safeStorage?: SafeStorageLike | null
  /** Absolute path override for the encrypted key blob. */
  keyFilePath?: string
  /** Allow MAIN_VITE_DB_KEY / MATERIEL_DB_KEY when no other source is set. */
  allowEnvKey?: boolean
}

export type SafeStorageLike = {
  isEncryptionAvailable: () => boolean
  encryptString: (plain: string) => Buffer
  decryptString: (encrypted: Buffer) => string
}

export function getDefaultKeyFilePath(dbPath: string): string {
  return `${dbPath}${KEY_FILE_SUFFIX}`
}

function keyFromPassphrase(passphrase: string): Buffer {
  return createHash('sha256').update(passphrase, 'utf8').digest()
}

function keyFromString(value: string): Buffer {
  // Prefer hex (64 chars = 32 bytes); otherwise SHA-256 the string.
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex')
  }
  return createHash('sha256').update(value, 'utf8').digest()
}

function tryLoadElectronSafeStorage(): SafeStorageLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as { safeStorage?: SafeStorageLike }
    if (electron?.safeStorage?.isEncryptionAvailable?.()) {
      return electron.safeStorage
    }
  } catch {
    // Not running inside Electron (unit tests, scripts).
  }
  return null
}

function readEnvKey(): string | undefined {
  return process.env.MAIN_VITE_DB_KEY || process.env.MATERIEL_DB_KEY || undefined
}

/**
 * Resolve the AES key used with SQLCipher (AES-256).
 * Precedence: explicit `key` → `passphrase` → env → safeStorage key file.
 */
export function resolveDatabaseKey(options: ResolveKeyOptions): ResolvedKey {
  if (options.key !== undefined) {
    const key =
      typeof options.key === 'string' ? keyFromString(options.key) : Buffer.from(options.key)
    if (key.length < 16) {
      throw new Error('Database key must be at least 16 bytes')
    }
    return { key, source: 'explicit' }
  }

  if (options.passphrase !== undefined && options.passphrase.length > 0) {
    return { key: keyFromPassphrase(options.passphrase), source: 'passphrase' }
  }

  if (options.allowEnvKey !== false) {
    const envKey = readEnvKey()
    if (envKey) {
      return { key: keyFromString(envKey), source: 'env' }
    }
  }

  const safeStorage =
    options.safeStorage === undefined ? tryLoadElectronSafeStorage() : options.safeStorage

  const keyFilePath = options.keyFilePath ?? getDefaultKeyFilePath(options.dbPath)
  const dir = dirname(keyFilePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  if (safeStorage?.isEncryptionAvailable()) {
    if (existsSync(keyFilePath)) {
      const encrypted = readFileSync(keyFilePath)
      const hex = safeStorage.decryptString(encrypted)
      return { key: Buffer.from(hex, 'hex'), source: 'safeStorage' }
    }

    const key = randomBytes(32)
    const encrypted = safeStorage.encryptString(key.toString('hex'))
    writeFileSync(keyFilePath, encrypted, { mode: 0o600 })
    return { key, source: 'safeStorage' }
  }

  // Never allow plaintext key files in production (even if ALLOW_DEV_DB_KEY is set).
  if (isProductionAppEnv()) {
    throw new Error(
      'No database key available. Production requires Electron safeStorage (or an explicit key/passphrase).'
    )
  }

  // Dev / headless fallback when OS keychain encryption is unavailable (common on Linux CI).
  const allowDevFile =
    process.env.MAIN_VITE_APP_ENV === 'development' ||
    process.env.NODE_ENV === 'development' ||
    process.env.MAIN_VITE_ALLOW_DEV_DB_KEY === 'true'

  if (!allowDevFile) {
    throw new Error(
      'No database key available. Pass key/passphrase, set MATERIEL_DB_KEY, or run under Electron with safeStorage.'
    )
  }

  const devKeyPath = `${keyFilePath}.dev`
  if (existsSync(devKeyPath)) {
    return { key: Buffer.from(readFileSync(devKeyPath, 'utf8').trim(), 'hex'), source: 'dev-file' }
  }

  const key = randomBytes(32)
  writeFileSync(devKeyPath, key.toString('hex'), { mode: 0o600 })
  console.warn(
    '[db] safeStorage unavailable — wrote plaintext dev key to',
    devKeyPath,
    '(development only)'
  )
  return { key, source: 'dev-file' }
}

/** Fingerprint for diagnostics (never log the raw key). */
export function keyFingerprint(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 12)
}
