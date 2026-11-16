import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PartInfo } from '../../../shared/parts'
import type { CompleteSystemInfo } from '../../../shared/systems'
import {
  listSystemMaintenance,
  systemHasDueMaintenance,
  systemTrackedPartIds
} from '../../../shared/system-maintenance'
import { ammoInputFromLoad } from '../../../shared/ammo-from-load'
import type { LoadDevelopmentInfo } from '../../../shared/loads'

function part(partial: Partial<PartInfo> & Pick<PartInfo, 'id' | 'type'>): PartInfo {
  return {
    manufacturer: 'Acme',
    value: 0,
    status: 'In Use',
    platforms: ['bolt_action'],
    name: partial.type === 'Barrel' ? 'Tube 1' : null,
    model: 'M1',
    serialNumber: null,
    totalRoundCount: 0,
    roundsAfterCleaning: 0,
    maintenanceInterval: 500,
    caliber: partial.type === 'Barrel' ? '6.5 Creedmoor' : null,
    gunsmith: null,
    twistRate: null,
    barrelLife: partial.type === 'Barrel' ? 3000 : null,
    muzzleType: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial
  }
}

function systemStub(
  partial: Pick<CompleteSystemInfo, 'id' | 'actionId' | 'barrelId'> & Partial<CompleteSystemInfo>
): CompleteSystemInfo {
  return {
    name: 'Test Rifle',
    buildType: 'custom',
    platform: 'bolt_action',
    chassisId: 'c1',
    opticId: null,
    suppressorId: null,
    laserIrId: null,
    lightId: null,
    miscPartIds: [],
    imageUrl: null,
    imageScale: null,
    notes: null,
    factoryManufacturer: null,
    factoryModel: null,
    factoryCartridge: null,
    factoryActionMaintenance: null,
    factoryBarrelMaintenance: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial
  }
}

test('systemTrackedPartIds includes action, barrel, suppressor, and accessories', () => {
  const system = systemStub({
    id: 'sys-1',
    actionId: 'a1',
    barrelId: 'b1',
    suppressorId: 's1',
    miscPartIds: ['m1']
  })

  assert.deepEqual(systemTrackedPartIds(system), ['a1', 'b1', 'm1', 's1'])
})

test('listSystemMaintenance scopes to the rifle and flags due parts', () => {
  const system = systemStub({
    id: 'sys-1',
    name: 'Test Rifle',
    actionId: 'a1',
    barrelId: 'b1',
    suppressorId: 's1',
    miscPartIds: []
  })

  const partsById = new Map<string, PartInfo>([
    ['a1', part({ id: 'a1', type: 'Action', roundsAfterCleaning: 400, maintenanceInterval: 500 })],
    [
      'b1',
      part({
        id: 'b1',
        type: 'Barrel',
        roundsAfterCleaning: 100,
        maintenanceInterval: 300,
        totalRoundCount: 100
      })
    ],
    [
      's1',
      part({ id: 's1', type: 'Suppressor', roundsAfterCleaning: 50, maintenanceInterval: 1000 })
    ],
    [
      'other',
      part({ id: 'other', type: 'Action', roundsAfterCleaning: 999, maintenanceInterval: 500 })
    ]
  ])

  const items = listSystemMaintenance(system, partsById)
  assert.equal(items.length, 3)
  assert.ok(!items.some((item) => item.partId === 'other'))
  assert.equal(items[0].partId, 'a1')
  assert.equal(items[0].percent, 80)
  assert.ok(systemHasDueMaintenance(system, partsById))

  const fresh = new Map(partsById)
  fresh.set(
    'a1',
    part({ id: 'a1', type: 'Action', roundsAfterCleaning: 100, maintenanceInterval: 500 })
  )
  fresh.set(
    'b1',
    part({ id: 'b1', type: 'Barrel', roundsAfterCleaning: 50, maintenanceInterval: 300 })
  )
  fresh.set(
    's1',
    part({ id: 's1', type: 'Suppressor', roundsAfterCleaning: 10, maintenanceInterval: 1000 })
  )
  assert.equal(systemHasDueMaintenance(system, fresh), false)
})

test('ammoInputFromLoad prefills cartridge, powder, bullet from load', () => {
  const load = {
    id: 'load-1',
    name: 'Match 140',
    caliber: '6.5 Creedmoor',
    bulletManufacturer: 'Hornady',
    bulletModel: 'ELD-M 140',
    brassManufacturer: 'Lapua',
    brassModel: null,
    powderManufacturer: 'Hodgdon',
    powderModel: 'H4350',
    primerManufacturer: 'Federal',
    primerModel: '210M',
    powderCharge: 41.5,
    coal: 2.8,
    cbto: 2.15,
    velocity: null,
    sd: null,
    es: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  } satisfies LoadDevelopmentInfo

  const input = ammoInputFromLoad(load, 40, { acquiredDate: '2026-11-16' })
  assert.equal(input.caliber, '6.5 Creedmoor')
  assert.equal(input.quantity, 40)
  assert.equal(input.type, 'Handload')
  assert.equal(input.loadId, 'load-1')
  assert.equal(input.bulletManufacturer, 'Hornady')
  assert.equal(input.bulletType, 'ELD-M 140')
  assert.equal(input.powderManufacturer, 'Hodgdon')
  assert.equal(input.powder, 'H4350')
  assert.equal(input.chargeWeight, 41.5)
  assert.equal(input.acquiredDate, '2026-11-16')
  assert.equal(input.caseName, null)
  assert.ok(input.name?.includes('6.5 Creedmoor'))
})
