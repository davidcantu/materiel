/**
 * AI key + capability orchestration (main process only).
 */

import type {
  AiCapabilities,
  AiListModelsResult,
  AiProviderId,
  AiSaveKeyInput,
  AiSetModelInput,
  AiStatusInfo,
  AiTestConnectionResult
} from '../../shared/ai'
import { AI_PROVIDER_IDS } from '../../shared/ai'
import { mapUnknownError } from './errors'
import {
  isAiEncryptionAvailable,
  keyFingerprint,
  loadApiKey,
  maskedKeySuffix,
  removeApiKey,
  saveApiKey,
  type KeyStoreDeps
} from './key-store'
import {
  emptyCapabilities,
  loadAiPrefs,
  updateAiPrefs,
  type PrefsDeps
} from './prefs'
import { createLLMProvider, type FetchImpl } from './providers'

export type AiServiceDeps = PrefsDeps &
  KeyStoreDeps & {
    fetchImpl?: FetchImpl
  }

function assertProvider(value: unknown): AiProviderId {
  if (typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value)) {
    return value as AiProviderId
  }
  throw new Error('Invalid AI provider.')
}

function resolveProvider(provider: AiProviderId | undefined, deps?: AiServiceDeps): AiProviderId {
  if (provider) return assertProvider(provider)
  return loadAiPrefs(deps).provider
}

function capabilitiesForStatus(
  provider: AiProviderId,
  apiKey: string | null,
  model: string | null,
  deps?: AiServiceDeps
): AiCapabilities {
  if (!apiKey) return emptyCapabilities()
  const prefs = loadAiPrefs(deps)
  const cache = prefs.capabilityCache
  if (
    cache &&
    cache.provider === provider &&
    cache.fingerprint === keyFingerprint(apiKey) &&
    (cache.model === model || (!cache.model && !model))
  ) {
    return cache.capabilities
  }
  // Fingerprint matches but model differs — still show last check with note
  if (cache && cache.provider === provider && cache.fingerprint === keyFingerprint(apiKey)) {
    return cache.capabilities
  }
  return emptyCapabilities()
}

export function getAiStatus(
  provider?: AiProviderId,
  deps?: AiServiceDeps,
  options?: { rememberProvider?: boolean }
): AiStatusInfo {
  const prefs = loadAiPrefs(deps)
  const resolved = resolveProvider(provider ?? prefs.provider, deps)
  if (options?.rememberProvider && resolved !== prefs.provider) {
    updateAiPrefs({ provider: resolved }, deps)
  }
  const model = loadAiPrefs(deps).modelByProvider[resolved] ?? null
  const apiKey = loadApiKey(resolved, deps)
  return {
    provider: resolved,
    model,
    hasKey: apiKey !== null,
    maskedSuffix: maskedKeySuffix(resolved, deps),
    encryptionAvailable: isAiEncryptionAvailable(deps),
    capabilities: capabilitiesForStatus(resolved, apiKey, model, deps)
  }
}

export function saveAiKey(input: AiSaveKeyInput, deps?: AiServiceDeps): AiStatusInfo {
  const provider = assertProvider(input.provider)
  const apiKey = input.apiKey?.trim() ?? ''
  if (!apiKey) {
    throw new Error('API key is empty.')
  }
  saveApiKey(provider, apiKey, deps)

  const modelPatch =
    input.model !== undefined
      ? { [provider]: input.model && input.model.trim() ? input.model.trim() : null }
      : {}

  updateAiPrefs(
    {
      provider,
      modelByProvider: modelPatch,
      capabilityCache: null
    },
    deps
  )

  return getAiStatus(provider, deps)
}

export function removeAiKey(provider?: AiProviderId, deps?: AiServiceDeps): AiStatusInfo {
  const prefs = loadAiPrefs(deps)
  const resolved = resolveProvider(provider ?? prefs.provider, deps)
  removeApiKey(resolved, deps)
  updateAiPrefs(
    {
      provider: resolved,
      capabilityCache:
        prefs.capabilityCache?.provider === resolved ? null : prefs.capabilityCache
    },
    deps
  )
  return getAiStatus(resolved, deps)
}

export function setAiModel(input: AiSetModelInput, deps?: AiServiceDeps): AiStatusInfo {
  const provider = assertProvider(input.provider)
  const model = input.model.trim()
  if (!model) {
    throw new Error('Model is empty.')
  }
  updateAiPrefs(
    {
      provider,
      modelByProvider: { [provider]: model }
    },
    deps
  )
  return getAiStatus(provider, deps)
}

export async function listAiModels(
  provider?: AiProviderId,
  deps?: AiServiceDeps
): Promise<AiListModelsResult> {
  const resolved = resolveProvider(provider, deps)
  const apiKey = loadApiKey(resolved, deps)
  if (!apiKey) {
    return { ok: false, error: 'No API key saved for this provider.' }
  }
  try {
    const llm = createLLMProvider(resolved, {
      apiKey,
      fetchImpl: deps?.fetchImpl
    })
    const { models } = await llm.listModels()
    return { ok: true, models }
  } catch (error) {
    return { ok: false, error: mapUnknownError(error, apiKey) }
  }
}

function buildOkCapabilities(message: string | null = null): AiCapabilities {
  const checkedAt = new Date().toISOString()
  return {
    apiKey: 'ok',
    billing: 'ok',
    analysisReady: 'ok',
    vision: 'stub',
    checkedAt,
    message
  }
}

function buildFailCapabilities(
  stage: 'apiKey' | 'billing',
  message: string
): AiCapabilities {
  const checkedAt = new Date().toISOString()
  if (stage === 'apiKey') {
    return {
      apiKey: 'fail',
      billing: 'unknown',
      analysisReady: 'fail',
      vision: 'stub',
      checkedAt,
      message
    }
  }
  return {
    apiKey: 'ok',
    billing: 'fail',
    analysisReady: 'fail',
    vision: 'stub',
    checkedAt,
    message
  }
}

export async function testAiConnection(
  provider?: AiProviderId,
  deps?: AiServiceDeps
): Promise<AiTestConnectionResult> {
  const prefs = loadAiPrefs(deps)
  const resolved = resolveProvider(provider ?? prefs.provider, deps)
  const apiKey = loadApiKey(resolved, deps)
  const model = prefs.modelByProvider[resolved] ?? null

  if (!apiKey) {
    const status = getAiStatus(resolved, deps)
    return { ok: false, error: 'No API key saved for this provider.', status }
  }

  const llm = createLLMProvider(resolved, {
    apiKey,
    fetchImpl: deps?.fetchImpl
  })

  try {
    // Auth step
    let models
    try {
      ;({ models } = await llm.listModels())
    } catch (error) {
      const message = mapUnknownError(error, apiKey)
      const capabilities = buildFailCapabilities('apiKey', message)
      updateAiPrefs(
        {
          provider: resolved,
          capabilityCache: {
            fingerprint: keyFingerprint(apiKey),
            provider: resolved,
            model,
            capabilities
          }
        },
        deps
      )
      return { ok: false, error: message, status: getAiStatus(resolved, deps) }
    }

    const chosen =
      (model && models.some((m) => m.id === model) ? model : null) ?? models[0]?.id ?? null

    if (!chosen) {
      const message = `${llm.label} returned no models for this API key.`
      const capabilities = buildFailCapabilities('apiKey', message)
      updateAiPrefs(
        {
          provider: resolved,
          capabilityCache: {
            fingerprint: keyFingerprint(apiKey),
            provider: resolved,
            model,
            capabilities
          }
        },
        deps
      )
      return { ok: false, error: message, status: getAiStatus(resolved, deps) }
    }

    // Persist model if we auto-picked one
    if (!model) {
      updateAiPrefs(
        {
          provider: resolved,
          modelByProvider: { [resolved]: chosen }
        },
        deps
      )
    }

    // Billing / spend check via minimal completion
    try {
      await llm.complete({
        model: chosen,
        prompt: 'Reply with the single word: pong',
        maxTokens: 8
      })
    } catch (error) {
      const message = mapUnknownError(error, apiKey)
      const capabilities = buildFailCapabilities('billing', message)
      updateAiPrefs(
        {
          provider: resolved,
          modelByProvider: { [resolved]: chosen },
          capabilityCache: {
            fingerprint: keyFingerprint(apiKey),
            provider: resolved,
            model: chosen,
            capabilities
          }
        },
        deps
      )
      return { ok: false, error: message, status: getAiStatus(resolved, deps) }
    }

    const capabilities = buildOkCapabilities('Connection ok — analysis-ready (basic).')
    updateAiPrefs(
      {
        provider: resolved,
        modelByProvider: { [resolved]: chosen },
        capabilityCache: {
          fingerprint: keyFingerprint(apiKey),
          provider: resolved,
          model: chosen,
          capabilities
        }
      },
      deps
    )

    return { ok: true, status: getAiStatus(resolved, deps) }
  } catch (error) {
    const message = mapUnknownError(error, apiKey)
    return { ok: false, error: message, status: getAiStatus(resolved, deps) }
  }
}

export function selectAiProvider(provider: AiProviderId, deps?: AiServiceDeps): AiStatusInfo {
  const resolved = assertProvider(provider)
  updateAiPrefs({ provider: resolved }, deps)
  return getAiStatus(resolved, deps)
}
