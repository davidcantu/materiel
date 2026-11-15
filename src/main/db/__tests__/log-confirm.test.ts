import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AmmoInventoryInfo } from '../../../shared/ammo'
import { formatLogConfirmSummary } from '../../../shared/log-confirm'

test('formatLogConfirmSummary includes rounds, cartridge, lot, and remaining', () => {
  const ammo = {
    id: 'ammo-1',
    name: 'Match',
    type: 'Factory',
    caliber: '.308 Winchester',
    quantity: 82,
    lotNumber: 'X'
  } as AmmoInventoryInfo

  assert.equal(
    formatLogConfirmSummary({
      roundsFired: 42,
      cartridge: '.308 Winchester',
      ammo,
      location: 'Home Range',
      systemName: 'Gas Gun'
    }),
    '42 rounds · .308 Winchester · Lot X · 40 left · Home Range'
  )
})

test('formatLogConfirmSummary falls back to manual entry', () => {
  assert.equal(
    formatLogConfirmSummary({
      roundsFired: 10,
      cartridge: '6.5 Creedmoor',
      ammo: null,
      location: 'Match Site',
      systemName: null
    }),
    '10 rounds · 6.5 Creedmoor · Manual entry · Match Site'
  )
})
