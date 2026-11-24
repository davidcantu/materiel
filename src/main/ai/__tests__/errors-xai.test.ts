import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mapProviderHttpError } from '../errors'

test('xAI 401 mentions console.x.ai and not Groq confusion', () => {
  const message = mapProviderHttpError({
    status: 401,
    providerLabel: 'xAI (Grok)',
    bodyText: 'Unauthorized'
  })
  assert.match(message, /401/)
  assert.match(message, /console\.x\.ai/)
  assert.match(message, /not a Groq/i)
})

test('Groq 401 points at console.groq.com', () => {
  const message = mapProviderHttpError({
    status: 401,
    providerLabel: 'Groq',
    bodyText: 'Unauthorized'
  })
  assert.match(message, /console\.groq\.com/)
})
