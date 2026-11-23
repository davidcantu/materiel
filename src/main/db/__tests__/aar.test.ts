import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import {
  aarToMarkdown,
  completeAar,
  computePpewsMismatch,
  createAar,
  getAar,
  getAarByLogEntryId,
  listAars,
  updateAar,
  upsertPpews,
  validateAarComplete
} from '../aar'
import { openTestDatabase } from '../connection'
import { addShootingLog } from '../shooting-logs'
import { createCustomSystem } from '../systems'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-aar-'))
  dirs.push(dir)
  const db = openTestDatabase(join(dir, 'test.db'))
  const createdAt = '2026-01-01T00:00:00.000Z'

  const insertPart = db.prepare(
    `INSERT INTO parts (
      id, manufacturer, value, type, status, platforms, name, model, serial_number,
      total_round_count, rounds_after_cleaning, maintenance_interval,
      caliber, gunsmith, twist_rate, barrel_life, created_at, updated_at
    ) VALUES (
      @id, 'Bartlein', 100, @type, 'In Stock', '["bolt_action"]', @name, 'M1', @serial,
      0, 0, 500, @caliber, @gunsmith, @twist, @life, @createdAt, @createdAt
    )`
  )

  insertPart.run({
    id: 'action-1',
    type: 'Action',
    name: null,
    serial: 'S1',
    caliber: null,
    gunsmith: null,
    twist: null,
    life: null,
    createdAt
  })
  insertPart.run({
    id: 'barrel-1',
    type: 'Barrel',
    name: 'Heavy Palma',
    serial: null,
    caliber: '6.5 Creedmoor',
    gunsmith: 'Shop',
    twist: 8,
    life: 3000,
    createdAt
  })
  insertPart.run({
    id: 'chassis-1',
    type: 'Chassis',
    name: null,
    serial: null,
    caliber: null,
    gunsmith: null,
    twist: null,
    life: null,
    createdAt
  })

  createCustomSystem(db, {
    id: 'sys-1',
    name: 'Test Rifle',
    platform: 'bolt_action',
    actionId: 'action-1',
    barrelId: 'barrel-1',
    chassisId: 'chassis-1'
  })

  return db
}

test('createAar prefills rifle setup from barrel and seeds PPEWS rows', () => {
  const db = setup()
  const aar = createAar(db, { barrelId: 'barrel-1', matchName: 'Club Match' })
  assert.equal(aar.status, 'draft')
  assert.equal(aar.ppews.length, 6)
  assert.ok(aar.rifleSetup?.includes('Bartlein'))
  assert.ok(aar.rifleSetup?.includes('6.5 Creedmoor'))
  assert.ok(aar.rifleSetup?.includes('1:8'))
})

test('one AAR per log entry; second create returns existing', () => {
  const db = setup()
  const log = addShootingLog(db, {
    systemId: 'sys-1',
    date: '2026-03-01',
    location: 'Range',
    roundsFired: 40,
    sessionType: 'Match',
    placement: 3
  })
  const first = createAar(db, { logEntryId: log.id })
  const second = createAar(db, { logEntryId: log.id })
  assert.equal(first.id, second.id)
  assert.equal(getAarByLogEntryId(db, log.id)?.id, first.id)
  assert.equal(first.placement, 3)
  assert.equal(first.matchLevel, 'club')
})

test('complete validation requires match info + six PPEWS categories', () => {
  const db = setup()
  const aar = createAar(db, {})
  const incomplete = validateAarComplete(aar)
  assert.equal(incomplete.ok, false)
  assert.ok(incomplete.missing.includes('matchName'))

  updateAar(db, aar.id, {
    matchName: 'Regional',
    matchDateStart: '2026-04-01',
    matchLevel: 'regional',
    score: 80,
    scorePossible: 100
  })
  upsertPpews(db, aar.id, [
    { category: 'wind', pointsDropped: 15 },
    { category: 'process', pointsDropped: 8 }
  ])
  const ready = getAar(db, aar.id)!
  const validation = validateAarComplete(ready)
  assert.equal(validation.ok, true)

  const mismatch = computePpewsMismatch(ready)
  assert.equal(mismatch.warned, true)
  assert.equal(mismatch.ppewsTotal, 23)
  assert.equal(mismatch.scoreDropped, 20)

  // Equal totals → no warning
  upsertPpews(db, aar.id, [{ category: 'wind', pointsDropped: 12 }])
  const equal = getAar(db, aar.id)!
  assert.equal(computePpewsMismatch(equal).ppewsTotal, 20)
  assert.equal(computePpewsMismatch(equal).warned, false)

  const completed = completeAar(db, aar.id)
  assert.equal(completed.status, 'complete')
  assert.ok(aarToMarkdown(completed).includes('# Regional'))
  assert.equal(listAars(db).length, 1)
})
