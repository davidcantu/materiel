/**
 * Persist OAuth refresh tokens via Electron safeStorage when available.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app, safeStorage } from 'electron'
import type { BackupProviderId } from './types'

export type StoredOAuthTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  scope?: string
}

function tokensDir(): string {
  const dir = join(app.getPath('userData'), 'backup-oauth')
  mkdirSync(dir, { recursive: true })
  return dir
}

function tokenPath(providerId: BackupProviderId): string {
  return join(tokensDir(), `${providerId}.token`)
}

function encodePayload(json: string): Buffer {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(json)
  }
  // Dev / headless fallback — still keep off git; file lives under userData.
  return Buffer.from(json, 'utf8')
}

function decodePayload(buf: Buffer): string {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buf)
    } catch {
      // Fall through to utf8 for older plaintext / mixed environments.
    }
  }
  return buf.toString('utf8')
}

export function loadOAuthTokens(providerId: BackupProviderId): StoredOAuthTokens | null {
  const path = tokenPath(providerId)
  if (!existsSync(path)) return null
  try {
    const raw = decodePayload(readFileSync(path))
    const parsed = JSON.parse(raw) as StoredOAuthTokens
    if (!parsed?.accessToken) return null
    return parsed
  } catch (error) {
    console.warn(`[backup] failed to read tokens for ${providerId}:`, error)
    return null
  }
}

export function saveOAuthTokens(providerId: BackupProviderId, tokens: StoredOAuthTokens): void {
  const path = tokenPath(providerId)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, encodePayload(JSON.stringify(tokens)), { mode: 0o600 })
}

export function clearOAuthTokens(providerId: BackupProviderId): void {
  const path = tokenPath(providerId)
  if (existsSync(path)) {
    unlinkSync(path)
  }
}

export function hasOAuthTokens(providerId: BackupProviderId): boolean {
  return loadOAuthTokens(providerId) !== null
}
