import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import { completeAar, createAar, updateAar, upsertPpews } from '../aar'
import { openTestDatabase } from '../connection'
import { getPpewsTrends } from '../trends'
import { createCustomSystem } from '../systems'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-trends-'))
  dirs.push(dir)
  const db = openTestDatabase(join(dir, 'test.db'))
  const createdAt = '2026-01-01T00:00:00.000Z'
  const insertPart = db.prepare(
    `INSERT INTO parts (
      id, manufacturer, value, type, status, platforms, model, serial_number,
      total_round_count, rounds_after_cleaning, created_at, updated_at
    ) VALUES (
      @id, 'Acme', 100, @type, 'In Stock', '["bolt_action"]', 'M', @serial,
      0, 0, @createdAt, @createdAt
    )`
  )
  insertPart.run({ id: 'action-1', type: 'Action', serial: 'S1', createdAt })
  insertPart.run({ id: 'barrel-1', type: 'Barrel', serial: null, createdAt })
  insertPart.run({ id: 'chassis-1', type: 'Chassis', serial: null, createdAt })
  createCustomSystem(db, {
    id: 'sys-1',
    name: 'Rifle',
    platform: 'bolt_action',
    actionId: 'action-1',
    barrelId: 'barrel-1',
    chassisId: 'chassis-1'
  })
  return db
}

function completeWithPpews(
  db: Database.Database,
  opts: { name: string; date: string; level: 'club' | 'regional'; wind: number; process: number }
): void {
  const aar = createAar(db, { barrelId: 'barrel-1' })
  updateAar(db, aar.id, {
    matchName: opts.name,
    matchDateStart: opts.date,
    matchLevel: opts.level
  })
  upsertPpews(db, aar.id, [
    { category: 'wind', pointsDropped: opts.wind },
    { category: 'process', pointsDropped: opts.process }
  ])
  completeAar(db, aar.id)
}

test('trends aggregate complete AARs and ignore drafts', () => {
  const db = setup()
  completeWithPpews(db, { name: 'A', date: '2026-01-10', level: 'club', wind: 10, process: 2 })
  completeWithPpews(db, {
    name: 'B',
    date: '2026-02-10',
    level: 'regional',
    wind: 4,
    process: 6
  })
  const draft = createAar(db, { matchName: 'Draft only' })
  updateAar(db, draft.id, {
    matchName: 'Draft',
    matchDateStart: '2026-03-01',
    matchLevel: 'club'
  })
  upsertPpews(db, draft.id, [{ category: 'wind', pointsDropped: 99 }])

  const all = getPpewsTrends(db)
  assert.equal(all.aarCount, 2)
  const wind = all.categories.find((c) => c.category === 'wind')
  const process = all.categories.find((c) => c.category === 'process')
  assert.equal(wind?.totalPointsDropped, 14)
  assert.equal(process?.totalPointsDropped, 8)
  assert.equal(all.topLeak, 'wind')
  assert.ok(all.callout?.includes('Wind'))
  assert.equal(all.series.length, 2)

  const filtered = getPpewsTrends(db, { matchLevel: 'regional' })
  assert.equal(filtered.aarCount, 1)
  assert.equal(filtered.categories.find((c) => c.category === 'wind')?.totalPointsDropped, 4)
})
