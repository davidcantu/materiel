import type { AiModelInfo, AiProviderId } from '../../../shared/ai'

export type CompleteOptions = {
  model: string
  prompt: string
  maxTokens?: number
}

export type CompleteResult = {
  text: string
  model: string
}

export type ListModelsResult = {
  models: AiModelInfo[]
}

export type TestConnectionResult = {
  models: AiModelInfo[]
  completionOk: boolean
  completionText?: string
}

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

export type LLMProvider = {
  id: AiProviderId
  label: string
  listModels: () => Promise<ListModelsResult>
  /**
   * Auth (list models) + minimal completion for a billing / spend check.
   * Uses `model` when provided; otherwise the first listed model.
   */
  testConnection: (model?: string | null) => Promise<TestConnectionResult>
  /** Stub-friendly completion for later AI Coach work. */
  complete: (options: CompleteOptions) => Promise<CompleteResult>
}

export type ProviderFactoryOptions = {
  apiKey: string
  fetchImpl?: FetchImpl
  timeoutMs?: number
}
