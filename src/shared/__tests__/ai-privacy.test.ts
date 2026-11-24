import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_AI_PRIVACY_PREFS,
  normalizeAiPrivacyPrefs
} from '../ai-privacy'
import { AI_PROVIDER_KEY_HINTS, AI_PROVIDER_LABELS } from '../ai'

test('AI privacy defaults favor minimization', () => {
  assert.equal(DEFAULT_AI_PRIVACY_PREFS.includeLocations, false)
  assert.equal(DEFAULT_AI_PRIVACY_PREFS.includeNotes, false)
  assert.equal(DEFAULT_AI_PRIVACY_PREFS.confirmBeforeSend, true)
  assert.equal(DEFAULT_AI_PRIVACY_PREFS.includeEquipmentDetail, true)
})

test('normalizeAiPrivacyPrefs fills defaults', () => {
  const prefs = normalizeAiPrivacyPrefs({ includeLocations: true })
  assert.equal(prefs.includeLocations, true)
  assert.equal(prefs.includeNotes, false)
  assert.equal(prefs.confirmBeforeSend, true)
})

test('provider labels distinguish Grok (xAI) from Groq', () => {
  assert.match(AI_PROVIDER_LABELS.xai, /Grok/i)
  assert.match(AI_PROVIDER_LABELS.groq, /Groq/)
  assert.match(AI_PROVIDER_KEY_HINTS.xai, /console\.x\.ai/)
  assert.match(AI_PROVIDER_KEY_HINTS.xai, /Do not pick Groq/i)
  assert.match(AI_PROVIDER_KEY_HINTS.groq, /not xAI\/Grok/i)
})
