/**
 * Persist activated license payload via Electron safeStorage when available.
 * File lives under `{userData}/license.dat`.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

export type StoredLicense = {
  email: string
  key: string
  activatedAt: string
}

export type SafeStorageLike = {
  isEncryptionAvailable: () => boolean
  encryptString: (plain: string) => Buffer
  decryptString: (encrypted: Buffer) => string
}

export type LicenseStoreOptions = {
  /** Absolute path to license.dat (tests). */
  filePath?: string
  /** Injected safeStorage (tests / non-Electron). */
  safeStorage?: SafeStorageLike | null
  /** userData root when not under Electron. */
  userDataPath?: string
}

function tryLoadElectronSafeStorage(): SafeStorageLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as {
      safeStorage?: SafeStorageLike
      app?: { getPath: (name: string) => string }
    }
    if (electron?.safeStorage?.isEncryptionAvailable?.()) {
      return electron.safeStorage
    }
  } catch {
    // Not running inside Electron.
  }
  return null
}

function defaultUserDataPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as { app?: { getPath: (name: string) => string } }
    if (electron?.app?.getPath) {
      return electron.app.getPath('userData')
    }
  } catch {
    // fall through
  }
  return join(process.cwd(), '.materiel-userdata')
}

export function getLicenseFilePath(options: LicenseStoreOptions = {}): string {
  if (options.filePath) return options.filePath
  const root = options.userDataPath ?? defaultUserDataPath()
  return join(root, 'license.dat')
}

function encodePayload(json: string, safeStorage: SafeStorageLike | null): Buffer {
  if (safeStorage?.isEncryptionAvailable()) {
    return safeStorage.encryptString(json)
  }
  // Dev / headless fallback — file stays under userData, never committed.
  return Buffer.from(json, 'utf8')
}

function decodePayload(buf: Buffer, safeStorage: SafeStorageLike | null): string {
  if (safeStorage?.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buf)
    } catch {
      // Fall through for older plaintext / mixed environments.
    }
  }
  return buf.toString('utf8')
}

function resolveSafeStorage(options: LicenseStoreOptions): SafeStorageLike | null {
  if (options.safeStorage !== undefined) return options.safeStorage
  return tryLoadElectronSafeStorage()
}

export function loadStoredLicense(options: LicenseStoreOptions = {}): StoredLicense | null {
  const path = getLicenseFilePath(options)
  if (!existsSync(path)) return null
  try {
    const safeStorage = resolveSafeStorage(options)
    const raw = decodePayload(readFileSync(path), safeStorage)
    const parsed = JSON.parse(raw) as StoredLicense
    if (!parsed?.email || !parsed?.key || !parsed?.activatedAt) return null
    return parsed
  } catch (error) {
    console.warn('[license] failed to read license.dat:', error)
    return null
  }
}

export function saveStoredLicense(
  license: StoredLicense,
  options: LicenseStoreOptions = {}
): { encrypted: boolean } {
  const path = getLicenseFilePath(options)
  mkdirSync(dirname(path), { recursive: true })
  const safeStorage = resolveSafeStorage(options)
  const encrypted = Boolean(safeStorage?.isEncryptionAvailable())
  writeFileSync(path, encodePayload(JSON.stringify(license), safeStorage), { mode: 0o600 })
  return { encrypted }
}

export function clearStoredLicense(options: LicenseStoreOptions = {}): void {
  const path = getLicenseFilePath(options)
  if (existsSync(path)) {
    unlinkSync(path)
  }
}

export function isLicenseEncryptionAvailable(options: LicenseStoreOptions = {}): boolean {
  const safeStorage = resolveSafeStorage(options)
  return Boolean(safeStorage?.isEncryptionAvailable())
}
