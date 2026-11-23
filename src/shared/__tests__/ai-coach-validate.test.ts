import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateCoachAnalysis } from '../../main/ai/analyze'
import { validateCofExtraction } from '../../main/ai/extract-cof'

test('validateCoachAnalysis accepts well-formed coach JSON', () => {
  const result = validateCoachAnalysis({
    summary: 'Wind is the leak.',
    strengths: ['Process held on positional'],
    focusAreas: [
      {
        category: 'wind',
        summary: 'Full-value calls under mirage',
        evidence: ['12 pts dropped']
      }
    ],
    drills: [
      {
        title: 'Flag reading',
        description: '10 minutes of hold confirmation',
        category: 'wind'
      }
    ],
    caveats: ['Only two AARs']
  })
  assert.equal(result.summary, 'Wind is the leak.')
  assert.equal(result.focusAreas[0]?.category, 'wind')
})

test('validateCoachAnalysis rejects missing summary', () => {
  assert.throws(() => validateCoachAnalysis({ strengths: [] }), /summary/i)
})

test('validateCofExtraction maps stages', () => {
  const result = validateCofExtraction({
    stages: [
      {
        stageNumber: 1,
        stageName: 'Kylies',
        description: '3 targets',
        targets: [{ label: 'A', distance: 400 }],
        roundCount: 10,
        parTimeSec: 90
      }
    ],
    notes: 'Blurry corner'
  })
  assert.equal(result.stages.length, 1)
  assert.equal(result.stages[0]?.stageName, 'Kylies')
  assert.equal(result.notes, 'Blurry corner')
})
