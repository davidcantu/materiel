/**
 * Non-secret AI preferences next to encrypted keys: userData/ai-keys/prefs.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { AiCapabilities, AiProviderId } from '../../shared/ai'
import { AI_PROVIDER_IDS } from '../../shared/ai'
import {
  DEFAULT_AI_PRIVACY_PREFS,
  normalizeAiPrivacyPrefs,
  type AiPrivacyPrefs
} from '../../shared/ai-privacy'
import { aiKeysDir, type KeyStoreDeps } from './key-store'

export type AiCapabilityCache = {
  fingerprint: string
  provider: AiProviderId
  model: string | null
  capabilities: AiCapabilities
}

export type AiPrefs = {
  provider: AiProviderId
  modelByProvider: Partial<Record<AiProviderId, string | null>>
  capabilityCache: AiCapabilityCache | null
  privacy: AiPrivacyPrefs
}

const DEFAULT_PREFS: AiPrefs = {
  provider: 'anthropic',
  modelByProvider: {},
  capabilityCache: null,
  privacy: { ...DEFAULT_AI_PRIVACY_PREFS }
}

export type PrefsDeps = KeyStoreDeps & {
  /** Override prefs file path (tests). */
  prefsPath?: string
}

function prefsPath(deps?: PrefsDeps): string {
  if (deps?.prefsPath) return deps.prefsPath
  const userData = deps?.userDataPath ?? app.getPath('userData')
  return join(userData, 'ai-keys', 'prefs.json')
}

function isProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value)
}

function normalizePrefs(raw: unknown): AiPrefs {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PREFS, modelByProvider: {}, privacy: { ...DEFAULT_AI_PRIVACY_PREFS } }
  }

  const obj = raw as Record<string, unknown>
  const provider = isProviderId(obj.provider) ? obj.provider : DEFAULT_PREFS.provider

  const modelByProvider: Partial<Record<AiProviderId, string | null>> = {}
  if (obj.modelByProvider && typeof obj.modelByProvider === 'object') {
    for (const id of AI_PROVIDER_IDS) {
      const value = (obj.modelByProvider as Record<string, unknown>)[id]
      if (typeof value === 'string' && value.trim()) {
        modelByProvider[id] = value.trim()
      } else if (value === null) {
        modelByProvider[id] = null
      }
    }
  } else if (typeof obj.model === 'string' && obj.model.trim()) {
    // Backward-compatible single model field
    modelByProvider[provider] = obj.model.trim()
  }

  let capabilityCache: AiCapabilityCache | null = null
  if (obj.capabilityCache && typeof obj.capabilityCache === 'object') {
    const cache = obj.capabilityCache as Record<string, unknown>
    if (
      typeof cache.fingerprint === 'string' &&
      isProviderId(cache.provider) &&
      cache.capabilities &&
      typeof cache.capabilities === 'object'
    ) {
      const caps = cache.capabilities as AiCapabilities
      capabilityCache = {
        fingerprint: cache.fingerprint,
        provider: cache.provider,
        model: typeof cache.model === 'string' ? cache.model : null,
        capabilities: {
          apiKey: caps.apiKey ?? 'unknown',
          billing: caps.billing ?? 'unknown',
          analysisReady: caps.analysisReady ?? 'unknown',
          vision: caps.vision ?? 'stub',
          checkedAt: caps.checkedAt ?? null,
          message: caps.message ?? null
        }
      }
    }
  }

  return {
    provider,
    modelByProvider,
    capabilityCache,
    privacy: normalizeAiPrivacyPrefs(obj.privacy)
  }
}

export function loadAiPrefs(deps?: PrefsDeps): AiPrefs {
  const path = prefsPath(deps)
  if (!existsSync(path)) {
    return { ...DEFAULT_PREFS, modelByProvider: {}, privacy: { ...DEFAULT_AI_PRIVACY_PREFS } }
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    return normalizePrefs(parsed)
  } catch (error) {
    console.warn('[ai] failed to read prefs.json:', error)
    return { ...DEFAULT_PREFS, modelByProvider: {}, privacy: { ...DEFAULT_AI_PRIVACY_PREFS } }
  }
}

export function saveAiPrefs(prefs: AiPrefs, deps?: PrefsDeps): void {
  const path = prefsPath(deps)
  mkdirSync(aiKeysDir(deps), { recursive: true })
  writeFileSync(path, `${JSON.stringify(prefs, null, 2)}\n`, { mode: 0o600 })
}

export function updateAiPrefs(patch: Partial<AiPrefs>, deps?: PrefsDeps): AiPrefs {
  const current = loadAiPrefs(deps)
  const next: AiPrefs = {
    provider: patch.provider ?? current.provider,
    modelByProvider: {
      ...current.modelByProvider,
      ...(patch.modelByProvider ?? {})
    },
    capabilityCache:
      patch.capabilityCache !== undefined ? patch.capabilityCache : current.capabilityCache,
    privacy: patch.privacy
      ? normalizeAiPrivacyPrefs({ ...current.privacy, ...patch.privacy })
      : current.privacy
  }
  saveAiPrefs(next, deps)
  return next
}

export function emptyCapabilities(message: string | null = null): AiCapabilities {
  return {
    apiKey: 'unknown',
    billing: 'unknown',
    analysisReady: 'unknown',
    vision: 'stub',
    checkedAt: null,
    message
  }
}
