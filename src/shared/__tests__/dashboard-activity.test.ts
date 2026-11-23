import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  aggregateMonthlyToYearly,
  peakActivityBucket,
  type MonthlyRounds
} from '../dashboard'

test('aggregateMonthlyToYearly rolls months into calendar years', () => {
  const months: MonthlyRounds[] = [
    { key: '2024-11', label: 'Nov', fullLabel: 'November 2024', rounds: 40 },
    { key: '2024-12', label: 'Dec', fullLabel: 'December 2024', rounds: 60 },
    { key: '2025-01', label: 'Jan', fullLabel: 'January 2025', rounds: 10 },
    { key: '2025-06', label: 'Jun', fullLabel: 'June 2025', rounds: 0 },
    { key: '2026-03', label: 'Mar', fullLabel: 'March 2026', rounds: 120 }
  ]
  const years = aggregateMonthlyToYearly(months)
  assert.deepEqual(
    years.map((y) => ({ key: y.key, rounds: y.rounds })),
    [
      { key: '2024', rounds: 100 },
      { key: '2025', rounds: 10 },
      { key: '2026', rounds: 120 }
    ]
  )
  const peak = peakActivityBucket(years)
  assert.equal(peak?.key, '2026')
  assert.equal(peak?.rounds, 120)
})
