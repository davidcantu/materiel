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

test('compatibility: actions only for bolt; laser/light for AR and pistol', () => {
  assert.deepEqual(platformsForPartType('Action'), ['bolt_action'])
  assert.deepEqual(platformsForPartType('Lower'), ['ar_pattern'])
  assert.deepEqual(platformsForPartType('Frame'), ['pistol'])
  assert.deepEqual(platformsForPartType('LaserIR'), ['ar_pattern', 'pistol'])
  assert.deepEqual(platformsForPartType('Light'), ['ar_pattern', 'pistol'])
  assert.ok(platformsForPartType('Optic').includes('bolt_action'))
  assert.ok(platformsForPartType('Optic').includes('pistol'))
})

test('smart create categories: intersection for multi-platform selection', () => {
  const both = partTypesForPlatforms(['ar_pattern', 'pistol'])
  assert.ok(both.includes('Optic'))
  assert.ok(both.includes('LaserIR'))
  assert.ok(both.includes('Light'))
  assert.ok(both.includes('Barrel'))
  assert.ok(!both.includes('Action'))
  assert.ok(!both.includes('Lower'))
  assert.ok(!both.includes('Frame'))
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
  const pistolFrame = createPart(db, {
    manufacturer: 'Glock',
    type: 'Frame',
    model: '19',
    serialNumber: 'F1',
    platforms: ['pistol']
  })
  const pistolSlide = createPart(db, {
    manufacturer: 'Glock',
    type: 'Slide',
    model: '19',
    platforms: ['pistol']
  })
  const pistolBarrel = createPart(db, {
    manufacturer: 'Glock',
    type: 'Barrel',
    caliber: '9mm',
    gunsmith: 'Factory',
    platforms: ['pistol']
  })
  const optic = createPart(db, {
    manufacturer: 'Trijicon',
    type: 'Optic',
    model: 'RMR',
    serialNumber: 'O1',
    platforms: ['ar_pattern', 'pistol']
  })
  const light = createPart(db, {
    manufacturer: 'SureFire',
    type: 'Light',
    model: 'X300',
    platforms: ['ar_pattern', 'pistol']
  })

  assert.equal(listParts(db, { platforms: ['bolt_action'] }).length, 1)
  assert.equal(listParts(db, { platforms: ['ar_pattern'] }).length, 5)
  assert.equal(listParts(db, { platforms: ['pistol'] }).length, 5)
  assert.ok(listParts(db, { platforms: ['ar_pattern'] }).some((p) => p.id === optic.id))
  assert.ok(listParts(db, { platforms: ['pistol'] }).some((p) => p.id === light.id))
  assert.ok(!listParts(db, { platforms: ['ar_pattern'] }).some((p) => p.id === boltAction.id))

  const ar = createCustomSystem(db, {
    name: 'AR Build',
    platform: 'ar_pattern',
    actionId: arLower.id,
    barrelId: arBarrel.id,
    chassisId: arUpper.id,
    opticId: optic.id,
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

  const pistol = createFactorySystem(db, {
    name: 'G19 Factory',
    platform: 'pistol',
    factoryManufacturer: 'Glock',
    factoryModel: '19 Gen5',
    factoryCartridge: '9mm'
  })
  assert.equal(pistol.platform, 'pistol')
  assert.ok(pistol.actionId.startsWith('action-'))

  // Keep unused pistol parts referenced so GC doesn't confuse the assertion above.
  assert.ok(pistolFrame.id)
  assert.ok(pistolSlide.id)
  assert.ok(pistolBarrel.id)
})
