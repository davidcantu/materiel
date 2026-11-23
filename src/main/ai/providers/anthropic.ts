/**
 * Anthropic Messages API + GET /v1/models.
 */

import type { AiModelInfo } from '../../../shared/ai'
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

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_TIMEOUT_MS = 20_000

async function readBody(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

export function createAnthropicProvider(options: ProviderFactoryOptions): LLMProvider {
  const fetchImpl: FetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const apiKey = options.apiKey.trim()
  const label = 'Anthropic'

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetchImpl(`${ANTHROPIC_BASE}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
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
        mapProviderHttpError({ status: res.status, bodyText, providerLabel: label }, apiKey)
      )
    }

    let payload: unknown
    try {
      payload = JSON.parse(bodyText) as unknown
    } catch {
      throw new Error(`${label} returned invalid JSON from /models.`)
    }

    const data =
      payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
        ? ((
            payload as {
              data: Array<{ id?: unknown; display_name?: unknown }>
            }
          ).data ?? [])
        : []

    const models: AiModelInfo[] = data
      .map((row) => {
        const id = typeof row.id === 'string' ? row.id.trim() : ''
        if (!id) return null
        const displayName =
          typeof row.display_name === 'string' && row.display_name.trim()
            ? row.display_name.trim()
            : id
        return { id, displayName }
      })
      .filter((row): row is AiModelInfo => row !== null)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))

    return { models }
  }

  async function complete(completeOptions: CompleteOptions): Promise<CompleteResult> {
    const userContent: Array<Record<string, unknown>> = []
    for (const image of completeOptions.images ?? []) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mimeType,
          data: image.base64
        }
      })
    }
    userContent.push({ type: 'text', text: completeOptions.prompt })

    const body: Record<string, unknown> = {
      model: completeOptions.model,
      max_tokens: completeOptions.maxTokens ?? 16,
      messages: [{ role: 'user', content: userContent }]
    }
    if (completeOptions.system?.trim()) {
      body.system = completeOptions.system.trim()
    }

    let res: Response
    try {
      res = await request('/messages', {
        method: 'POST',
        body: JSON.stringify(body)
      })
    } catch (error) {
      throw new Error(mapUnknownError(error, apiKey))
    }

    const bodyText = await readBody(res)
    if (!res.ok) {
      throw new Error(
        mapProviderHttpError({ status: res.status, bodyText, providerLabel: label }, apiKey)
      )
    }

    let payload: unknown
    try {
      payload = JSON.parse(bodyText) as unknown
    } catch {
      throw new Error(`${label} returned invalid JSON from /messages.`)
    }

    const content =
      payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as { content?: unknown }).content)
        ? (payload as { content: Array<{ type?: unknown; text?: unknown }> }).content
        : []
    const textParts = content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)

    const usageRaw =
      payload && typeof payload === 'object'
        ? (payload as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
        : undefined

    return {
      text: textParts.join(''),
      model: completeOptions.model,
      usage: usageRaw
        ? {
            inputTokens: usageRaw.input_tokens,
            outputTokens: usageRaw.output_tokens
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
      throw new Error(redactSecrets(`${label} returned no models for this API key.`, apiKey))
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
    id: 'anthropic',
    label,
    listModels,
    testConnection,
    complete
  }
}
