/**
 * OpenAI-compatible Chat Completions + Models API
 * (OpenAI, xAI, Groq).
 */

import type { AiModelInfo, AiProviderId } from '../../../shared/ai'
import { mapProviderHttpError, mapUnknownError } from '../errors'
import { redactSecrets } from '../redact'
import type {
  CompleteOptions,
  CompleteResult,
  FetchImpl,
  LLMProvider,
  ListModelsResult,
  ProviderFactoryOptions,
  TestConnectionResult
} from './types'

export type OpenAiCompatibleConfig = {
  id: AiProviderId
  label: string
  baseUrl: string
}

const DEFAULT_TIMEOUT_MS = 20_000

async function readBody(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig,
  options: ProviderFactoryOptions
): LLMProvider {
  const fetchImpl: FetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const apiKey = options.apiKey.trim()

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetchImpl(`${config.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(init?.headers ?? {})
        }
      })
    } finally {
      clearTimeout(timer)
    }
  }

  async function listModels(): Promise<ListModelsResult> {
    let res: Response
    try {
      res = await request('/models', { method: 'GET' })
    } catch (error) {
      throw new Error(mapUnknownError(error, apiKey))
    }

    const bodyText = await readBody(res)
    if (!res.ok) {
      throw new Error(
        mapProviderHttpError(
          { status: res.status, bodyText, providerLabel: config.label },
          apiKey
        )
      )
    }

    let payload: unknown
    try {
      payload = JSON.parse(bodyText) as unknown
    } catch {
      throw new Error(`${config.label} returned invalid JSON from /models.`)
    }

    const data =
      payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data: Array<{ id?: unknown; owned_by?: unknown }> }).data ?? [])
        : []

    const models: AiModelInfo[] = data
      .map((row) => {
        const id = typeof row.id === 'string' ? row.id.trim() : ''
        if (!id) return null
        return { id, displayName: id }
      })
      .filter((row): row is AiModelInfo => row !== null)
      .sort((a, b) => a.id.localeCompare(b.id))

    return { models }
  }

  async function complete(completeOptions: CompleteOptions): Promise<CompleteResult> {
    let res: Response
    try {
      res = await request('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: completeOptions.model,
          max_tokens: completeOptions.maxTokens ?? 16,
          messages: [{ role: 'user', content: completeOptions.prompt }]
        })
      })
    } catch (error) {
      throw new Error(mapUnknownError(error, apiKey))
    }

    const bodyText = await readBody(res)
    if (!res.ok) {
      throw new Error(
        mapProviderHttpError(
          { status: res.status, bodyText, providerLabel: config.label },
          apiKey
        )
      )
    }

    let payload: unknown
    try {
      payload = JSON.parse(bodyText) as unknown
    } catch {
      throw new Error(`${config.label} returned invalid JSON from /chat/completions.`)
    }

    const choices =
      payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as { choices?: unknown }).choices)
        ? (payload as { choices: Array<{ message?: { content?: unknown } }> }).choices
        : []
    const content = choices[0]?.message?.content
    const text = typeof content === 'string' ? content : ''
    return { text, model: completeOptions.model }
  }

  async function testConnection(model?: string | null): Promise<TestConnectionResult> {
    const { models } = await listModels()
    const chosen =
      (model && models.some((m) => m.id === model) ? model : null) ??
      models[0]?.id ??
      model ??
      null

    if (!chosen) {
      throw new Error(
        redactSecrets(`${config.label} returned no models for this API key.`, apiKey)
      )
    }

    const completion = await complete({
      model: chosen,
      prompt: 'Reply with the single word: pong',
      maxTokens: 8
    })

    return {
      models,
      completionOk: true,
      completionText: completion.text
    }
  }

  return {
    id: config.id,
    label: config.label,
    listModels,
    testConnection,
    complete
  }
}

export const OPENAI_COMPATIBLE_CONFIGS: Record<
  Exclude<AiProviderId, 'anthropic'>,
  OpenAiCompatibleConfig
> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1'
  },
  xai: {
    id: 'xai',
    label: 'xAI',
    baseUrl: 'https://api.x.ai/v1'
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1'
  }
}
