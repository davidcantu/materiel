import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import { openTestDatabase } from '../connection'
import { addShootingLog, deleteShootingLog, updateShootingLog } from '../shooting-logs'
import { createCustomSystem } from '../systems'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-logs-'))
  dirs.push(dir)
  const db = openTestDatabase(join(dir, 'test.db'))
  const createdAt = '2026-01-01T00:00:00.000Z'

  const insertPart = db.prepare(
    `INSERT INTO parts (
      id, name, manufacturer, value, type, status, model, serial_number,
      total_round_count, rounds_after_cleaning, maintenance_interval,
      caliber, gunsmith, twist_rate, barrel_life, created_at, updated_at
    ) VALUES (
      @id, @name, 'Acme', 100, @type, 'In Stock', 'M1', @serial,
      0, 0, 500, @caliber, @gunsmith, @twist, @life, @createdAt, @createdAt
    )`
  )

  insertPart.run({
    id: 'action-1',
    name: 'Action',
    type: 'Action',
    serial: 'S1',
    caliber: null,
    gunsmith: null,
    twist: null,
    life: null,
    createdAt
  })
  insertPart.run({
    id: 'barrel-1',
    name: 'Barrel',
    type: 'Barrel',
    serial: null,
    caliber: '6.5 Creedmoor',
    gunsmith: 'Shop',
    twist: 8,
    life: 3000,
    createdAt
  })
  insertPart.run({
    id: 'chassis-1',
    name: 'Chassis',
    type: 'Chassis',
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
    actionId: 'action-1',
    barrelId: 'barrel-1',
    chassisId: 'chassis-1'
  })

  db.prepare(
    `INSERT INTO ammo_inventory (
      id, name, type, caliber, quantity, created_at, updated_at
    ) VALUES ('ammo-1', 'Match', 'Factory', '6.5 Creedmoor', 100, ?, ?)`
  ).run(createdAt, createdAt)

  return db
}

function partRounds(
  db: Database.Database,
  id: string
): {
  total: number
  after: number
} {
  const row = db
    .prepare(
      `SELECT total_round_count AS total, rounds_after_cleaning AS after FROM parts WHERE id = ?`
    )
    .get(id) as { total: number; after: number }
  return row
}

function ammoQty(db: Database.Database, id: string): number | null {
  const row = db.prepare(`SELECT quantity FROM ammo_inventory WHERE id = ?`).get(id) as
    { quantity: number } | undefined
  return row?.quantity ?? null
}

test('addShootingLog adjusts round counts and ammo atomically', () => {
  const db = setup()
  try {
    addShootingLog(db, {
      id: 'log-1',
      systemId: 'sys-1',
      ammoId: 'ammo-1',
      date: '2026-11-10',
      location: 'Range',
      roundsFired: 40,
      sessionType: 'Practice'
    })

    assert.deepEqual(partRounds(db, 'action-1'), { total: 40, after: 40 })
    assert.deepEqual(partRounds(db, 'barrel-1'), { total: 40, after: 40 })
    assert.equal(partRounds(db, 'chassis-1').total, 0)
    assert.equal(ammoQty(db, 'ammo-1'), 60)
  } finally {
    db.close()
  }
})

test('update and delete shooting logs reverse and re-apply side effects', () => {
  const db = setup()
  try {
    addShootingLog(db, {
      id: 'log-1',
      systemId: 'sys-1',
      ammoId: 'ammo-1',
      date: '2026-11-10',
      location: 'Range',
      roundsFired: 40
    })

    updateShootingLog(db, {
      id: 'log-1',
      roundsFired: 10,
      ammoId: 'ammo-1'
    })

    assert.deepEqual(partRounds(db, 'action-1'), { total: 10, after: 10 })
    assert.equal(ammoQty(db, 'ammo-1'), 90)

    deleteShootingLog(db, 'log-1')

    assert.deepEqual(partRounds(db, 'action-1'), { total: 0, after: 0 })
    assert.deepEqual(partRounds(db, 'barrel-1'), { total: 0, after: 0 })
    assert.equal(ammoQty(db, 'ammo-1'), 100)
  } finally {
    db.close()
  }
})

test('ammo row is removed when quantity reaches zero', () => {
  const db = setup()
  try {
    addShootingLog(db, {
      systemId: 'sys-1',
      ammoId: 'ammo-1',
      date: '2026-11-10',
      location: 'Range',
      roundsFired: 100
    })

    assert.equal(ammoQty(db, 'ammo-1'), null)
  } finally {
    db.close()
  }
})
