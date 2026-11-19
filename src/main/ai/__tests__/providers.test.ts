import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAnthropicProvider } from '../providers/anthropic'
import { createOpenAiCompatibleProvider } from '../providers/openai-compatible'
import { mapProviderHttpError } from '../errors'

test('OpenAI-compatible listModels parses data[] and redacts auth errors', async () => {
  const calls: Array<{ url: string; auth?: string | null }> = []
  const provider = createOpenAiCompatibleProvider(
    { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
    {
      apiKey: 'sk-test-KEYVALUE1234567890',
      fetchImpl: async (url, init) => {
        const headers = new Headers(init?.headers)
        calls.push({ url, auth: headers.get('Authorization') })
        return new Response(
          JSON.stringify({
            data: [{ id: 'gpt-4.1-mini' }, { id: 'gpt-4o' }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
  )

  const { models } = await provider.listModels()
  assert.deepEqual(
    models.map((m) => m.id),
    ['gpt-4.1-mini', 'gpt-4o']
  )
  assert.equal(calls[0]?.url, 'https://api.openai.com/v1/models')
  assert.equal(calls[0]?.auth, 'Bearer sk-test-KEYVALUE1234567890')
})

test('OpenAI-compatible testConnection lists models then completes', async () => {
  let step = 0
  const provider = createOpenAiCompatibleProvider(
    { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
    {
      apiKey: 'gsk_test_abcdef',
      fetchImpl: async (url, init) => {
        step += 1
        if (String(url).endsWith('/models')) {
          return new Response(JSON.stringify({ data: [{ id: 'llama-3.1-8b-instant' }] }), {
            status: 200
          })
        }
        assert.match(String(url), /\/chat\/completions$/)
        assert.equal(init?.method, 'POST')
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'pong' } }]
          }),
          { status: 200 }
        )
      }
    }
  )

  const result = await provider.testConnection()
  assert.equal(result.completionOk, true)
  assert.equal(result.completionText, 'pong')
  assert.equal(result.models[0]?.id, 'llama-3.1-8b-instant')
  assert.equal(step, 2)
})

test('Anthropic listModels uses x-api-key and maps 401 without leaking key', async () => {
  const key = 'sk-ant-secret-TESTKEYVALUE999'
  const provider = createAnthropicProvider({
    apiKey: key,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.anthropic.com/v1/models')
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('x-api-key'), key)
      assert.equal(headers.get('anthropic-version'), '2023-06-01')
      return new Response(JSON.stringify({ error: { message: `bad ${key}` } }), { status: 401 })
    }
  })

  await assert.rejects(
    () => provider.listModels(),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.equal(error.message.includes(key), false)
      assert.match(error.message, /rejected the API key/)
      return true
    }
  )
})

test('Anthropic complete reads text content blocks', async () => {
  const provider = createAnthropicProvider({
    apiKey: 'sk-ant-ok',
    fetchImpl: async (url, init) => {
      assert.match(String(url), /\/messages$/)
      assert.equal(init?.method, 'POST')
      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'pong' }]
        }),
        { status: 200 }
      )
    }
  })

  const result = await provider.complete({
    model: 'claude-sonnet-4-5',
    prompt: 'ping',
    maxTokens: 8
  })
  assert.equal(result.text, 'pong')
})

test('mapProviderHttpError helper stays stable for tests', () => {
  assert.match(mapProviderHttpError({ status: 500, providerLabel: 'xAI' }), /unavailable/)
})
