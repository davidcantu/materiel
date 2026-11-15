import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import { openTestDatabase } from '../connection'
import {
  createPart,
  deletePart,
  listParts,
  resetPartMaintenance,
  setPartStatus,
  updatePart
} from '../parts'
import { createCustomSystem, deleteSystem } from '../systems'
import { ensureLocalProfile } from '../profile'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-parts-'))
  dirs.push(dir)
  return openTestDatabase(join(dir, 'test.db'))
}

test('parts CRUD: create, list, status, maintenance reset, delete', () => {
  const db = setup()
  ensureLocalProfile(db)

  const action = createPart(db, {
    manufacturer: 'Impact',
    type: 'Action',
    model: '737R',
    serialNumber: 'A-1',
    maintenanceInterval: 500
  })
  assert.equal(action.status, 'In Stock')
  assert.equal(action.maintenanceInterval, 500)

  const barrel = createPart(db, {
    manufacturer: 'Proof Research',
    type: 'Barrel',
    caliber: '6.5 Creedmoor',
    gunsmith: 'S&S',
    twistRate: 8,
    barrelLife: 3000
  })

  const listed = listParts(db, { types: ['Action', 'Barrel'] })
  assert.equal(listed.length, 2)

  const sold = setPartStatus(db, barrel.id, 'Sold')
  assert.equal(sold.status, 'Sold')

  updatePart(db, action.id, { roundsAfterCleaning: 120 })
  const reset = resetPartMaintenance(db, action.id)
  assert.equal(reset.roundsAfterCleaning, 0)

  deletePart(db, barrel.id)
  assert.equal(listParts(db).length, 1)
})

test('parts: refuses delete while part is on a system', () => {
  const db = setup()
  const action = createPart(db, {
    manufacturer: 'Impact',
    type: 'Action',
    model: '737R',
    serialNumber: '1'
  })
  const barrel = createPart(db, {
    manufacturer: 'Bartlein',
    type: 'Barrel',
    caliber: '6mm GT',
    gunsmith: 'Factory'
  })
  const chassis = createPart(db, {
    manufacturer: 'MDT',
    type: 'Chassis',
    model: 'ACC'
  })
  const optic = createPart(db, {
    manufacturer: 'Vortex',
    type: 'Optic',
    model: 'Razor',
    serialNumber: 'V1'
  })

  const system = createCustomSystem(db, {
    name: 'Test',
    platform: 'bolt_action',
    actionId: action.id,
    barrelId: barrel.id,
    chassisId: chassis.id,
    opticId: optic.id
  })

  assert.throws(() => deletePart(db, action.id), /In Use|referenced/)

  deleteSystem(db, system.id)
  deletePart(db, action.id)
  assert.equal(listParts(db, { types: ['Action'] }).length, 0)
})
