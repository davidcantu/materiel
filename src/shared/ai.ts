/** Shared AI / BYOK types (no secrets — safe for renderer). */

export type AiProviderId = 'anthropic' | 'openai' | 'xai' | 'groq'

export const AI_PROVIDER_IDS: readonly AiProviderId[] = [
  'anthropic',
  'openai',
  'xai',
  'groq'
] as const

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  xai: 'xAI',
  groq: 'Groq'
}

/** Capability check outcome for the Settings panel. */
export type AiCapabilityState = 'unknown' | 'ok' | 'fail' | 'stub'

export type AiCapabilities = {
  /** Auth: listModels succeeded with this key. */
  apiKey: AiCapabilityState
  /** Billing: minimal completion succeeded (or clear billing rejection). */
  billing: AiCapabilityState
  /** Basic analysis path ready (auth + billing ok). */
  analysisReady: AiCapabilityState
  /** Vision / image analysis — optional stub until Coach ships. */
  vision: AiCapabilityState
  checkedAt: string | null
  message: string | null
}

export type AiModelInfo = {
  id: string
  displayName: string
}

export type AiStatusInfo = {
  provider: AiProviderId
  model: string | null
  hasKey: boolean
  /** Last 4 characters of the stored key, or null when no key. */
  maskedSuffix: string | null
  encryptionAvailable: boolean
  capabilities: AiCapabilities
}

export type AiSaveKeyInput = {
  provider: AiProviderId
  apiKey: string
  model?: string | null
}

export type AiListModelsResult =
  | { ok: true; models: AiModelInfo[] }
  | { ok: false; error: string }

export type AiTestConnectionResult =
  | { ok: true; status: AiStatusInfo }
  | { ok: false; error: string; status: AiStatusInfo }

export type AiSetModelInput = {
  provider: AiProviderId
  model: string
}
