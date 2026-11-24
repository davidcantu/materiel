import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AI_ASSISTANT_SAMPLE_PROMPTS } from '../ai-assistant'

test('AI assistant sample prompts cover the requested sparks', () => {
  assert.ok(AI_ASSISTANT_SAMPLE_PROMPTS.length >= 5)
  const labels = AI_ASSISTANT_SAMPLE_PROMPTS.map((p) => p.label.toLowerCase())
  assert.ok(labels.some((l) => l.includes('training plan')))
  assert.ok(labels.some((l) => l.includes('inventory')))
  assert.ok(labels.some((l) => l.includes('equipment') || l.includes('tools')))
  for (const sample of AI_ASSISTANT_SAMPLE_PROMPTS) {
    assert.ok(sample.prompt.trim().length > 20)
    assert.ok(sample.title.trim().length > 0)
  }
})
