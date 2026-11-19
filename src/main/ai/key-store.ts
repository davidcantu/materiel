/**
 * Persist AI API keys via Electron safeStorage under userData/ai-keys/.
 * Production refuses plaintext fallback (same posture as backup OAuth tokens).
 */

import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app, safeStorage } from 'electron'
import type { AiProviderId } from '../../shared/ai'
import { isProductionAppEnv } from '../env'
import { keySuffix } from './redact'

export type SafeStorageLike = {
  isEncryptionAvailable: () => boolean
  encryptString: (plain: string) => Buffer
  decryptString: (encrypted: Buffer) => string
}

export type KeyStoreDeps = {
  userDataPath?: string
  safeStorage?: SafeStorageLike | null
  isProduction?: boolean
}

function resolveUserData(deps?: KeyStoreDeps): string {
  if (deps?.userDataPath) return deps.userDataPath
  return app.getPath('userData')
}

function resolveSafeStorage(deps?: KeyStoreDeps): SafeStorageLike | null {
  if (deps && 'safeStorage' in deps) return deps.safeStorage ?? null
  return safeStorage
}

function resolveProduction(deps?: KeyStoreDeps): boolean {
  if (deps?.isProduction !== undefined) return deps.isProduction
  return isProductionAppEnv()
}

export function aiKeysDir(deps?: KeyStoreDeps): string {
  const dir = join(resolveUserData(deps), 'ai-keys')
  mkdirSync(dir, { recursive: true })
  return dir
}

function keyPath(providerId: AiProviderId, deps?: KeyStoreDeps): string {
  return join(aiKeysDir(deps), `${providerId}.key`)
}

export function isAiEncryptionAvailable(deps?: KeyStoreDeps): boolean {
  const store = resolveSafeStorage(deps)
  return Boolean(store?.isEncryptionAvailable())
}

function encodePayload(plain: string, deps?: KeyStoreDeps): Buffer {
  const store = resolveSafeStorage(deps)
  if (store?.isEncryptionAvailable()) {
    return store.encryptString(plain)
  }
  if (resolveProduction(deps)) {
    throw new Error(
      'Cannot store AI API keys: OS secure storage (safeStorage) is unavailable in production.'
    )
  }
  return Buffer.from(plain, 'utf8')
}

function decodePayload(buf: Buffer, deps?: KeyStoreDeps): string {
  const store = resolveSafeStorage(deps)
  if (store?.isEncryptionAvailable()) {
    try {
      return store.decryptString(buf)
    } catch {
      // Fall through for older plaintext / mixed environments.
    }
  }
  return buf.toString('utf8')
}

export function loadApiKey(providerId: AiProviderId, deps?: KeyStoreDeps): string | null {
  const path = keyPath(providerId, deps)
  if (!existsSync(path)) return null
  try {
    const raw = decodePayload(readFileSync(path), deps).trim()
    return raw.length > 0 ? raw : null
  } catch (error) {
    console.warn(`[ai] failed to read key for ${providerId}:`, error)
    return null
  }
}

export function saveApiKey(providerId: AiProviderId, apiKey: string, deps?: KeyStoreDeps): void {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    throw new Error('API key is empty.')
  }
  const path = keyPath(providerId, deps)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, encodePayload(trimmed, deps), { mode: 0o600 })
}

export function removeApiKey(providerId: AiProviderId, deps?: KeyStoreDeps): void {
  const path = keyPath(providerId, deps)
  if (existsSync(path)) {
    unlinkSync(path)
  }
}

export function hasApiKey(providerId: AiProviderId, deps?: KeyStoreDeps): boolean {
  return loadApiKey(providerId, deps) !== null
}

export function maskedKeySuffix(providerId: AiProviderId, deps?: KeyStoreDeps): string | null {
  const key = loadApiKey(providerId, deps)
  if (!key) return null
  return keySuffix(key, 4)
}

/** Short fingerprint for capability-cache invalidation (never logged with the key). */
export function keyFingerprint(apiKey: string): string {
  return createHash('sha256').update(apiKey.trim()).digest('hex').slice(0, 16)
}
