import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import { openTestDatabase } from '../connection'
import { createPart, getPart } from '../parts'
import { ensureLocalProfile } from '../profile'
import { addShootingLog, listShootingLogs } from '../shooting-logs'
import { createCustomSystem, deleteSystem, getSystem } from '../systems'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-del-sys-'))
  dirs.push(dir)
  return openTestDatabase(join(dir, 'test.db'))
}

test('deleteSystem removes linked logs and returns parts to In Stock', () => {
  const db = setup()
  ensureLocalProfile(db)

  const action = createPart(db, {
    manufacturer: 'Impact',
    type: 'Action',
    model: '737R',
    serialNumber: 'A-del-1'
  })
  const barrel = createPart(db, {
    manufacturer: 'Proof',
    type: 'Barrel',
    name: 'Proof 26',
    caliber: '6.5 Creedmoor',
    gunsmith: 'S&S'
  })
  const chassis = createPart(db, {
    manufacturer: 'MDT',
    type: 'Chassis',
    model: 'ACC'
  })

  const system = createCustomSystem(db, {
    name: 'Delete me',
    platform: 'bolt_action',
    actionId: action.id,
    barrelId: barrel.id,
    chassisId: chassis.id
  })

  assert.equal(getPart(db, action.id)?.status, 'In Use')
  assert.equal(getPart(db, barrel.id)?.status, 'In Use')

  addShootingLog(db, {
    systemId: system.id,
    date: '2026-01-10',
    location: 'Range',
    roundsFired: 40,
    sessionType: 'Practice'
  })
  addShootingLog(db, {
    systemId: system.id,
    date: '2026-01-11',
    location: 'Range',
    roundsFired: 20,
    sessionType: 'Match',
    placement: 5
  })

  assert.equal(listShootingLogs(db).length, 2)
  assert.equal(getPart(db, barrel.id)?.totalRoundCount, 60)

  const result = deleteSystem(db, system.id)
  assert.equal(result.deletedLogCount, 2)
  assert.equal(getSystem(db, system.id), null)
  assert.equal(listShootingLogs(db).length, 0)

  assert.equal(getPart(db, action.id)?.status, 'In Stock')
  assert.equal(getPart(db, barrel.id)?.status, 'In Stock')
  assert.equal(getPart(db, chassis.id)?.status, 'In Stock')
  // Log side effects reversed before delete — rounds unwind.
  assert.equal(getPart(db, barrel.id)?.totalRoundCount, 0)
  assert.equal(getPart(db, action.id)?.totalRoundCount, 0)
})
