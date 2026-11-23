import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import { openTestDatabase } from '../connection'
import {
  createAmmoInventory,
  deleteAmmoInventory,
  listAmmoInventory,
  moveAmmoToPractice,
  updateAmmoInventory
} from '../ammo'
import { createLoad, deleteLoad, listLoads, updateLoad } from '../loads'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-ammo-'))
  dirs.push(dir)
  return openTestDatabase(join(dir, 'test.db'))
}

function sampleLoad(
  db: Database.Database,
  caliber = '6.5 Creedmoor'
): ReturnType<typeof createLoad> {
  return createLoad(db, {
    name: 'Comp Load',
    caliber,
    dateUpdated: '2026-11-22',
    bulletManufacturer: 'Hornady',
    bulletModel: '147gr ELD-M',
    brassManufacturer: 'Lapua',
    powderManufacturer: 'Hodgdon',
    powderModel: 'H4350',
    primerManufacturer: 'Federal',
    primerModel: 'GM205M',
    powderCharge: 41.5,
    lands: 2.2,
    cbto: 2.18,
    shoulderBump: 0.002,
    neckTension: 0.002
  })
}

test('loads CRUD: create, list, update, delete', () => {
  const db = setup()
  const load = sampleLoad(db)
  assert.equal(load.powderCharge, 41.5)
  assert.equal(load.lands, 2.2)
  assert.equal(load.cbto, 2.18)
  assert.equal(load.shoulderBump, 0.002)
  assert.equal(listLoads(db).length, 1)

  const updated = updateLoad(db, load.id, {
    dateUpdated: '2026-11-22',
    velocity: 2750,
    sd: 8.2,
    es: 24
  })
  assert.equal(updated.velocity, 2750)
  assert.equal(updated.sd, 8.2)

  deleteLoad(db, load.id)
  assert.equal(listLoads(db).length, 0)
})

test('loads: identity-only create is allowed', () => {
  const db = setup()
  const load = createLoad(db, {
    name: 'Notes Draft',
    caliber: '6mm GT',
    dateUpdated: '2026-11-22'
  })
  assert.equal(load.powderCharge, null)
  assert.equal(load.bulletManufacturer, '')
  assert.equal(load.lands, null)
})

test('ammo CRUD: factory and handload with load link', () => {
  const db = setup()
  const load = sampleLoad(db)

  const factory = createAmmoInventory(db, {
    name: 'Hornady Match',
    type: 'Factory',
    caliber: '6.5 Creedmoor',
    quantity: 100,
    acquiredDate: '2026-11-01',
    manufacturer: 'Hornady',
    lotNumber: 'LOT-1'
  })
  assert.equal(factory.type, 'Factory')
  assert.equal(factory.manufacturer, 'Hornady')
  assert.equal(factory.acquiredDate, '2026-11-01')

  const handload = createAmmoInventory(db, {
    type: 'Handload',
    caliber: '6.5 Creedmoor',
    quantity: 40,
    acquiredDate: '2026-11-02',
    loadId: load.id
  })
  assert.equal(handload.loadId, load.id)
  assert.ok(handload.name.includes('6.5 Creedmoor'))

  updateAmmoInventory(db, factory.id, { quantity: 80 })
  assert.equal(listAmmoInventory(db).find((a) => a.id === factory.id)?.quantity, 80)

  deleteAmmoInventory(db, factory.id)
  assert.equal(listAmmoInventory(db).length, 1)
})

test('ammo: refuses quantity <= 0 and missing date', () => {
  const db = setup()
  assert.throws(
    () =>
      createAmmoInventory(db, {
        type: 'Factory',
        caliber: '6.5 Creedmoor',
        quantity: 0,
        acquiredDate: '2026-11-01'
      }),
    /greater than 0/
  )
  assert.throws(
    () =>
      createAmmoInventory(db, {
        type: 'Factory',
        caliber: '6.5 Creedmoor',
        quantity: 10,
        acquiredDate: ''
      }),
    /Date made or purchased/
  )
})

test('moveAmmoToPractice: creates Practice Ammo then merges', () => {
  const db = setup()
  const match = createAmmoInventory(db, {
    name: 'Match Lot A',
    type: 'Factory',
    caliber: '6.5 Creedmoor',
    quantity: 50,
    acquiredDate: '2026-11-01',
    manufacturer: 'Hornady',
    lotNumber: 'A1',
    notes: 'Match ammo'
  })

  const practice = moveAmmoToPractice(db, match.id)
  assert.equal(practice.name, 'Practice Ammo')
  assert.equal(practice.caliber, '6.5 Creedmoor')
  assert.equal(practice.quantity, 50)
  assert.equal(practice.lotNumber, '')
  assert.match(practice.notes ?? '', /Match ammo|Created from/)
  assert.equal(listAmmoInventory(db).length, 1)

  const match2 = createAmmoInventory(db, {
    name: 'Match Lot B',
    type: 'Factory',
    caliber: '6.5 Creedmoor',
    quantity: 25,
    acquiredDate: '2026-11-02',
    lotNumber: 'B2'
  })
  const merged = moveAmmoToPractice(db, match2.id)
  assert.equal(merged.id, practice.id)
  assert.equal(merged.quantity, 75)
  assert.match(merged.notes ?? '', /Added 25 rounds from Match Lot B \(Lot: B2\)/)
  assert.equal(listAmmoInventory(db).length, 1)
})

test('moveAmmoToPractice: separate calibers stay separate', () => {
  const db = setup()
  const a = createAmmoInventory(db, {
    name: '6.5 Match',
    type: 'Factory',
    caliber: '6.5 Creedmoor',
    quantity: 10,
    acquiredDate: '2026-11-01'
  })
  const b = createAmmoInventory(db, {
    name: '6GT Match',
    type: 'Factory',
    caliber: '6mm GT',
    quantity: 20,
    acquiredDate: '2026-11-01'
  })
  moveAmmoToPractice(db, a.id)
  moveAmmoToPractice(db, b.id)
  const rows = listAmmoInventory(db)
  assert.equal(rows.length, 2)
  assert.ok(rows.every((r) => r.name === 'Practice Ammo'))
})
