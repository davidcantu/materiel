import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isNewerVersion, normalizeVersion, parseVersionCore } from '../compare'

test('normalizeVersion strips leading v', () => {
  assert.equal(normalizeVersion('v1.2.3'), '1.2.3')
  assert.equal(normalizeVersion('  V0.1.0 '), '0.1.0')
})

test('parseVersionCore reads numeric segments and drops pre-release', () => {
  assert.deepEqual(parseVersionCore('v1.2.3'), [1, 2, 3])
  assert.deepEqual(parseVersionCore('1.0.0-beta.1'), [1, 0, 0])
  assert.equal(parseVersionCore('not-a-version'), null)
  assert.equal(parseVersionCore(''), null)
})

test('isNewerVersion compares cores strictly', () => {
  assert.equal(isNewerVersion('0.2.0', '0.1.0'), true)
  assert.equal(isNewerVersion('v0.1.1', '0.1.0'), true)
  assert.equal(isNewerVersion('0.1.0', '0.1.0'), false)
  assert.equal(isNewerVersion('0.1.0', '0.2.0'), false)
  assert.equal(isNewerVersion('1.0', '1.0.0'), false)
  assert.equal(isNewerVersion('1.0.1', '1.0'), true)
  assert.equal(isNewerVersion('bad', '0.1.0'), false)
})
