import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keySuffix, maskSecret, redactSecrets } from '../redact'
import { mapProviderHttpError, mapUnknownError } from '../errors'

test('maskSecret keeps a short suffix', () => {
  const value = 'sk-ant-abcdefghijklmnopqrstuvwxyz'
  assert.equal(maskSecret(value), `${'•'.repeat(12)}${value.slice(-4)}`)
  assert.equal(keySuffix(value, 4), 'wxyz')
  assert.equal(maskSecret('abcd'), '••••')
})

test('redactSecrets removes explicit key and sk- patterns', () => {
  const key = 'sk-ant-secretvalue1234567890abcd'
  const message = `Authorization failed for ${key} and also sk-proj-ABCDEFGHIJKLMNOPQRSTUV`
  const redacted = redactSecrets(message, key)
  assert.equal(redacted.includes(key), false)
  assert.equal(redacted.includes('sk-proj-ABCDEFGHIJKLMNOPQRSTUV'), false)
  assert.match(redacted, /•/)
})

test('mapProviderHttpError never echoes body secrets', () => {
  const key = 'sk-live-SUPERSECRETKEYVALUE9999'
  const mapped = mapProviderHttpError(
    {
      status: 401,
      bodyText: `Invalid key ${key}`,
      providerLabel: 'OpenAI'
    },
    key
  )
  assert.equal(mapped.includes(key), false)
  assert.match(mapped, /rejected the API key/)
})

test('mapProviderHttpError maps billing and rate-limit codes', () => {
  assert.match(
    mapProviderHttpError({ status: 402, providerLabel: 'OpenAI' }),
    /billing/i
  )
  assert.match(
    mapProviderHttpError({ status: 429, providerLabel: 'Groq' }),
    /rate-limited/i
  )
})

test('mapUnknownError softens network failures and redacts keys', () => {
  const key = 'sk-ant-networkleak1234567890'
  assert.match(
    mapUnknownError(new TypeError(`fetch failed while using ${key}`), key),
    /Could not reach the provider/
  )
  const other = mapUnknownError(new Error(`bad request ${key}`), key)
  assert.equal(other.includes(key), false)
})
