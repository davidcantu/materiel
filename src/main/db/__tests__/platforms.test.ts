import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import {
  partTypesForPlatforms,
  platformsForPartType
} from '../../../shared/platforms'
import { openTestDatabase } from '../connection'
import { createPart, listParts } from '../parts'
import { createCustomSystem, createFactorySystem } from '../systems'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-plat-'))
  dirs.push(dir)
  return openTestDatabase(join(dir, 'test.db'))
}

test('compatibility: simplified AR/pistol lists; laser/IR on bolt', () => {
  assert.deepEqual(platformsForPartType('Action'), ['bolt_action'])
  assert.deepEqual(platformsForPartType('Lower'), ['ar_pattern'])
  assert.deepEqual(platformsForPartType('Pistol'), ['pistol'])
  assert.deepEqual(platformsForPartType('LaserIR'), ['bolt_action', 'ar_pattern', 'pistol'])
  assert.deepEqual(platformsForPartType('Light'), ['ar_pattern', 'pistol'])
  assert.ok(platformsForPartType('Optic').includes('bolt_action'))
  assert.ok(platformsForPartType('Optic').includes('pistol'))
  assert.ok(!platformsForPartType('Optic').includes('ar_pattern'))
  assert.ok(platformsForPartType('Trigger').includes('bolt_action'))

  const arTypes = partTypesForPlatforms(['ar_pattern'])
  assert.deepEqual(
    arTypes.filter((t) =>
      ['Lower', 'Upper', 'Barrel', 'LaserIR', 'Light', 'Suppressor', 'Misc'].includes(t)
    ).length,
    7
  )
  assert.ok(!arTypes.includes('Optic'))
  assert.ok(!arTypes.includes('Handguard'))
  assert.ok(!arTypes.includes('BCG'))

  const pistolTypes = partTypesForPlatforms(['pistol'])
  assert.ok(pistolTypes.includes('Pistol'))
  assert.ok(pistolTypes.includes('Optic'))
  assert.ok(!pistolTypes.includes('Frame'))
  assert.ok(!pistolTypes.includes('Barrel'))
})

test('smart create categories: intersection for multi-platform selection', () => {
  const both = partTypesForPlatforms(['ar_pattern', 'pistol'])
  assert.ok(both.includes('LaserIR'))
  assert.ok(both.includes('Light'))
  assert.ok(both.includes('Suppressor'))
  assert.ok(both.includes('Misc'))
  assert.ok(!both.includes('Optic'))
  assert.ok(!both.includes('Barrel'))
  assert.ok(!both.includes('Action'))
  assert.ok(!both.includes('Lower'))
  assert.ok(!both.includes('Pistol'))
})

test('parts list filters by platform; AR/pistol builds use platform core slots', () => {
  const db = setup()

  const boltAction = createPart(db, {
    manufacturer: 'Impact',
    type: 'Action',
    model: '737R',
    serialNumber: 'A1',
    platforms: ['bolt_action']
  })
  const boltLaser = createPart(db, {
    manufacturer: 'Wilcox',
    type: 'LaserIR',
    model: 'RAPTAR',
    platforms: ['bolt_action']
  })
  const arLower = createPart(db, {
    manufacturer: 'Aero',
    type: 'Lower',
    model: 'M4E1',
    serialNumber: 'L1',
    platforms: ['ar_pattern']
  })
  const arUpper = createPart(db, {
    manufacturer: 'BCM',
    type: 'Upper',
    model: 'Mk2',
    platforms: ['ar_pattern']
  })
  const arBarrel = createPart(db, {
    manufacturer: 'Criterion',
    type: 'Barrel',
    caliber: '.223',
    gunsmith: 'Factory',
    platforms: ['ar_pattern']
  })
  const pistol = createPart(db, {
    manufacturer: 'Glock',
    type: 'Pistol',
    model: '19 Gen5',
    serialNumber: 'P1',
    platforms: ['pistol']
  })
  const optic = createPart(db, {
    manufacturer: 'Trijicon',
    type: 'Optic',
    model: 'RMR',
    serialNumber: 'O1',
    platforms: ['pistol']
  })
  const light = createPart(db, {
    manufacturer: 'SureFire',
    type: 'Light',
    model: 'X300',
    platforms: ['ar_pattern', 'pistol']
  })

  assert.equal(listParts(db, { platforms: ['bolt_action'] }).length, 2)
  assert.ok(listParts(db, { platforms: ['ar_pattern'] }).some((p) => p.id === arLower.id))
  assert.ok(listParts(db, { platforms: ['pistol'] }).some((p) => p.id === pistol.id))
  assert.ok(listParts(db, { platforms: ['pistol'] }).some((p) => p.id === light.id))
  assert.ok(!listParts(db, { platforms: ['ar_pattern'] }).some((p) => p.id === boltAction.id))

  const ar = createCustomSystem(db, {
    name: 'AR Build',
    platform: 'ar_pattern',
    actionId: arLower.id,
    barrelId: arBarrel.id,
    chassisId: arUpper.id,
    lightId: light.id
  })
  assert.equal(ar.platform, 'ar_pattern')
  assert.equal(ar.lightId, light.id)

  assert.throws(
    () =>
      createCustomSystem(db, {
        name: 'Bad',
        platform: 'ar_pattern',
        actionId: boltAction.id,
        barrelId: arBarrel.id,
        chassisId: arUpper.id
      }),
    /Primary must be a Lower/
  )

  const pistolBuild = createCustomSystem(db, {
    name: 'G19 Custom',
    platform: 'pistol',
    actionId: pistol.id,
    barrelId: pistol.id,
    chassisId: pistol.id,
    opticId: optic.id
  })
  assert.equal(pistolBuild.actionId, pistol.id)
  assert.equal(pistolBuild.barrelId, pistol.id)
  assert.equal(pistolBuild.chassisId, pistol.id)

  const factoryPistol = createFactorySystem(db, {
    name: 'G19 Factory',
    platform: 'pistol',
    factoryManufacturer: 'Glock',
    factoryModel: '19 Gen5',
    factoryCartridge: '9mm'
  })
  assert.equal(factoryPistol.platform, 'pistol')
  assert.equal(factoryPistol.actionId, factoryPistol.barrelId)
  assert.equal(factoryPistol.actionId, factoryPistol.chassisId)
  assert.ok(factoryPistol.actionId.startsWith('action-'))

  const boltWithLaser = createCustomSystem(db, {
    name: 'Bolt + IR',
    platform: 'bolt_action',
    actionId: boltAction.id,
    barrelId: createPart(db, {
      manufacturer: 'Bartlein',
      type: 'Barrel',
      caliber: '6.5 Creedmoor',
      gunsmith: 'S&S',
      platforms: ['bolt_action']
    }).id,
    chassisId: createPart(db, {
      manufacturer: 'MDT',
      type: 'Chassis',
      model: 'ACC',
      platforms: ['bolt_action']
    }).id,
    opticId: createPart(db, {
      manufacturer: 'Vortex',
      type: 'Optic',
      model: 'Razor',
      serialNumber: 'V1',
      platforms: ['bolt_action']
    }).id,
    laserIrId: boltLaser.id
  })
  assert.equal(boltWithLaser.laserIrId, boltLaser.id)
})
