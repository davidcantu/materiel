import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clampImageScale, computeResizeDimensions, IMAGE_MAX_WIDTH } from '../../../shared/image'

test('computeResizeDimensions leaves small images unchanged', () => {
  assert.deepEqual(computeResizeDimensions(800, 600), { width: 800, height: 600 })
})

test('computeResizeDimensions caps width at IMAGE_MAX_WIDTH', () => {
  const result = computeResizeDimensions(2400, 1600)
  assert.equal(result.width, IMAGE_MAX_WIDTH)
  assert.equal(result.height, 800)
})

test('computeResizeDimensions handles odd aspect ratios', () => {
  const result = computeResizeDimensions(3000, 1000)
  assert.equal(result.width, IMAGE_MAX_WIDTH)
  assert.equal(result.height, 400)
})

test('clampImageScale bounds zoom', () => {
  assert.equal(clampImageScale(0.5), 1)
  assert.equal(clampImageScale(1.5), 1.5)
  assert.equal(clampImageScale(9), 3)
  assert.equal(clampImageScale(Number.NaN), 1)
})
