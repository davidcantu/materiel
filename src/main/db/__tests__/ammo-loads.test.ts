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
    bulletManufacturer: 'Hornady',
    bulletModel: '147gr ELD-M',
    brassManufacturer: 'Lapua',
    powderManufacturer: 'Hodgdon',
    powderModel: 'H4350',
    primerManufacturer: 'Federal',
    primerModel: 'GM205M',
    powderCharge: 41.5,
    coal: 2.8
  })
}

test('loads CRUD: create, list, update, delete', () => {
  const db = setup()
  const load = sampleLoad(db)
  assert.equal(load.powderCharge, 41.5)
  assert.equal(listLoads(db).length, 1)

  const updated = updateLoad(db, load.id, { velocity: 2750, sd: 8.2, es: 24 })
  assert.equal(updated.velocity, 2750)
  assert.equal(updated.sd, 8.2)

  deleteLoad(db, load.id)
  assert.equal(listLoads(db).length, 0)
})

test('ammo CRUD: factory and handload with load link', () => {
  const db = setup()
  const load = sampleLoad(db)

  const factory = createAmmoInventory(db, {
    name: 'Hornady Match',
    type: 'Factory',
    caliber: '6.5 Creedmoor',
    quantity: 100,
    manufacturer: 'Hornady',
    lotNumber: 'LOT-1'
  })
  assert.equal(factory.type, 'Factory')
  assert.equal(factory.manufacturer, 'Hornady')

  const handload = createAmmoInventory(db, {
    name: 'My Handload',
    type: 'Handload',
    caliber: '6.5 Creedmoor',
    quantity: 40,
    loadId: load.id
  })
  assert.equal(handload.loadId, load.id)

  updateAmmoInventory(db, factory.id, { quantity: 80 })
  assert.equal(listAmmoInventory(db).find((a) => a.id === factory.id)?.quantity, 80)

  deleteAmmoInventory(db, factory.id)
  assert.equal(listAmmoInventory(db).length, 1)
})

test('ammo: refuses quantity <= 0', () => {
  const db = setup()
  assert.throws(
    () =>
      createAmmoInventory(db, {
        name: 'Bad',
        type: 'Factory',
        caliber: '6.5 Creedmoor',
        quantity: 0
      }),
    /greater than 0/
  )
})

test('moveAmmoToPractice: creates Practice Ammo then merges', () => {
  const db = setup()
  const match = createAmmoInventory(db, {
    name: 'Match Lot A',
    type: 'Factory',
    caliber: '6.5 Creedmoor',
    quantity: 50,
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
    quantity: 10
  })
  const b = createAmmoInventory(db, {
    name: '6GT Match',
    type: 'Factory',
    caliber: '6mm GT',
    quantity: 20
  })
  moveAmmoToPractice(db, a.id)
  moveAmmoToPractice(db, b.id)
  const rows = listAmmoInventory(db)
  assert.equal(rows.length, 2)
  assert.ok(rows.every((r) => r.name === 'Practice Ammo'))
})
