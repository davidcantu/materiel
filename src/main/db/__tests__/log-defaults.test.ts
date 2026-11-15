import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AmmoInventoryInfo } from '../../../shared/ammo'
import { pickDefaultAmmo, rankLocations, systemCaliber } from '../../../shared/log-defaults'
import type { PartInfo } from '../../../shared/parts'
import type { ShootingLogInfo } from '../../../shared/shooting-logs'
import type { CompleteSystemInfo } from '../../../shared/systems'

function ammo(
  partial: Partial<AmmoInventoryInfo> & Pick<AmmoInventoryInfo, 'id' | 'caliber' | 'quantity'>
): AmmoInventoryInfo {
  return {
    name: partial.name ?? partial.id,
    type: 'Factory',
    loadId: null,
    manufacturer: null,
    lotNumber: null,
    notes: null,
    bulletManufacturer: null,
    bulletType: null,
    powderManufacturer: null,
    powder: null,
    chargeWeight: null,
    primerManufacturer: null,
    primer: null,
    caseManufacturer: null,
    caseName: null,
    seatingDepth: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial
  }
}

function log(
  partial: Partial<ShootingLogInfo> & Pick<ShootingLogInfo, 'id' | 'systemId' | 'location' | 'date'>
): ShootingLogInfo {
  return {
    barrelId: 'barrel-1',
    ammoId: null,
    cartridge: null,
    roundsFired: 10,
    velocity: null,
    sessionType: 'Practice',
    notes: null,
    createdAt: partial.date,
    updatedAt: partial.date,
    ...partial
  }
}

test('systemCaliber uses factory cartridge or barrel caliber', () => {
  const partsById = new Map<string, PartInfo>([
    [
      'barrel-1',
      {
        id: 'barrel-1',
        manufacturer: 'Proof',
        value: 0,
        type: 'Barrel',
        status: 'In Use',
        model: null,
        serialNumber: null,
        totalRoundCount: 0,
        roundsAfterCleaning: 0,
        maintenanceInterval: 300,
        caliber: '6.5 Creedmoor',
        gunsmith: null,
        twistRate: 8,
        barrelLife: 3000,
        muzzleType: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]
  ])

  const custom = {
    id: 'sys-1',
    buildType: 'custom',
    barrelId: 'barrel-1',
    factoryCartridge: null
  } as CompleteSystemInfo

  const factory = {
    id: 'sys-2',
    buildType: 'factory',
    barrelId: 'barrel-1',
    factoryCartridge: '.308 Winchester'
  } as CompleteSystemInfo

  assert.equal(systemCaliber(custom, partsById), '6.5 Creedmoor')
  assert.equal(systemCaliber(factory, partsById), '.308 Winchester')
})

test('rankLocations orders by frequency then most recent', () => {
  const ranked = rankLocations([
    log({ id: '1', systemId: 's', location: 'Rare', date: '2026-03-01' }),
    log({ id: '2', systemId: 's', location: 'Home Range', date: '2026-01-01' }),
    log({ id: '3', systemId: 's', location: 'Home Range', date: '2026-02-01' }),
    log({ id: '4', systemId: 's', location: 'Match Site', date: '2026-04-01' }),
    log({ id: '5', systemId: 's', location: 'Match Site', date: '2026-05-01' })
  ])

  assert.deepEqual(
    ranked.map((r) => r.location),
    ['Match Site', 'Home Range', 'Rare']
  )
  assert.equal(ranked[0].count, 2)
  assert.equal(ranked[0].lastUsed, '2026-05-01')
})

test('pickDefaultAmmo prefers sticky, then rifle-tied, then recent', () => {
  const inventory = [
    ammo({ id: 'lot-a', caliber: '6.5 Creedmoor', quantity: 50, name: 'A' }),
    ammo({ id: 'lot-b', caliber: '6.5 Creedmoor', quantity: 80, name: 'B' }),
    ammo({ id: 'lot-c', caliber: '.308 Winchester', quantity: 100, name: 'C' }),
    ammo({ id: 'lot-low', caliber: '6.5 Creedmoor', quantity: 5, name: 'Low' })
  ]

  const logs = [
    log({
      id: '1',
      systemId: 'rifle-1',
      location: 'X',
      date: '2026-01-01',
      ammoId: 'lot-a'
    }),
    log({
      id: '2',
      systemId: 'rifle-2',
      location: 'X',
      date: '2026-02-01',
      ammoId: 'lot-b'
    })
  ]

  assert.equal(
    pickDefaultAmmo({
      ammo: inventory,
      caliber: '6.5 Creedmoor',
      roundsFired: 20,
      systemId: 'rifle-1',
      logs,
      preferredAmmoId: 'lot-b'
    }),
    'lot-b',
    'sticky preferred when quantity allows'
  )

  assert.equal(
    pickDefaultAmmo({
      ammo: inventory,
      caliber: '6.5 Creedmoor',
      roundsFired: 20,
      systemId: 'rifle-1',
      logs
    }),
    'lot-a',
    'rifle-tied lot preferred over other history'
  )

  assert.equal(
    pickDefaultAmmo({
      ammo: inventory,
      caliber: '6.5 Creedmoor',
      roundsFired: 20,
      systemId: 'rifle-3',
      logs
    }),
    'lot-b',
    'most recently used overall when none tied to rifle'
  )

  assert.equal(
    pickDefaultAmmo({
      ammo: inventory,
      caliber: '6.5 Creedmoor',
      roundsFired: 10,
      systemId: 'rifle-1',
      logs,
      preferredAmmoId: 'lot-low'
    }),
    'lot-a',
    'insufficient sticky falls through to rifle-tied'
  )

  assert.equal(
    pickDefaultAmmo({
      ammo: inventory,
      caliber: '6.5 Creedmoor',
      roundsFired: 90,
      systemId: 'rifle-1',
      logs
    }),
    null,
    'no lot with enough quantity'
  )
})
