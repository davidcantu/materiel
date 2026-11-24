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

/** List-models / quick probes. */
const DEFAULT_TIMEOUT_MS = 20_000
/**
 * Chat completions for reasoning models (esp. xAI Grok) routinely exceed 20s.
 * xAI's own SDK samples use multi-minute timeouts.
 */
const DEFAULT_COMPLETE_TIMEOUT_MS = 120_000

async function readBody(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const part of content) {
    if (!part || typeof part !== 'object') continue
    const row = part as { type?: unknown; text?: unknown }
    if (typeof row.text === 'string' && row.text) {
      parts.push(row.text)
    }
  }
  return parts.join('\n')
}

function isReasoningModel(model: string): boolean {
  return /^grok-4/i.test(model.trim())
}

export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig,
  options: ProviderFactoryOptions
): LLMProvider {
  const fetchImpl: FetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const completeTimeoutMs = options.timeoutMs ?? DEFAULT_COMPLETE_TIMEOUT_MS
  const apiKey = options.apiKey.trim()

  async function request(
    path: string,
    init?: RequestInit,
    requestTimeoutMs: number = timeoutMs
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs)
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
    const messages: Array<Record<string, unknown>> = []
    if (completeOptions.system?.trim()) {
      messages.push({ role: 'system', content: completeOptions.system.trim() })
    }

    const images = completeOptions.images ?? []
    if (images.length === 0) {
      messages.push({ role: 'user', content: completeOptions.prompt })
    } else {
      const content: Array<Record<string, unknown>> = [
        { type: 'text', text: completeOptions.prompt }
      ]
      for (const image of images) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${image.mimeType};base64,${image.base64}`
          }
        })
      }
      messages.push({ role: 'user', content })
    }

    const maxTokens = completeOptions.maxTokens ?? 16
    const body: Record<string, unknown> = {
      model: completeOptions.model,
      messages
    }

    // xAI prefers max_completion_tokens; other OpenAI-compatible hosts still use max_tokens.
    if (config.id === 'xai') {
      body.max_completion_tokens = maxTokens
      // Grok 4.x reasons by default at "high" — too slow for interactive AI View.
      if (isReasoningModel(completeOptions.model)) {
        body.reasoning_effort = completeOptions.reasoningEffort ?? 'low'
      }
    } else {
      body.max_tokens = maxTokens
    }

    let res: Response
    try {
      res = await request(
        '/chat/completions',
        {
          method: 'POST',
          body: JSON.stringify(body)
        },
        completeTimeoutMs
      )
    } catch (error) {
      if (error instanceof Error && /abort/i.test(error.name + error.message)) {
        throw new Error(
          mapUnknownError(
            new Error(
              config.id === 'xai'
                ? 'xAI (Grok) timed out while reasoning. Try again, pick a lighter Grok model, or ask a shorter question.'
                : `${config.label} timed out waiting for a completion.`
            ),
            apiKey
          )
        )
      }
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
        ? (payload as {
            choices: Array<{
              finish_reason?: unknown
              message?: { content?: unknown }
            }>
          }).choices
        : []
    const choice = choices[0]
    const text = extractMessageText(choice?.message?.content).trim()
    if (!text) {
      const finish =
        typeof choice?.finish_reason === 'string' ? choice.finish_reason : 'unknown'
      throw new Error(
        `${config.label} returned an empty answer (finish_reason=${finish}). ` +
          (config.id === 'xai'
            ? 'Grok may still be budgeting tokens for reasoning — try again or choose a different Grok model in Settings.'
            : 'Try another model or shorten the prompt.')
      )
    }
    const usageRaw =
      payload && typeof payload === 'object'
        ? (payload as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage
        : undefined
    return {
      text,
      model: completeOptions.model,
      usage: usageRaw
        ? {
            inputTokens: usageRaw.prompt_tokens,
            outputTokens: usageRaw.completion_tokens
          }
        : undefined
    }
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
