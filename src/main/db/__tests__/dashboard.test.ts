import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import { openTestDatabase } from '../connection'
import { getDashboardSummary } from '../dashboard'
import { createPart } from '../parts'
import { ensureLocalProfile, updateProfile } from '../profile'
import { addShootingLog } from '../shooting-logs'
import { createCustomSystem } from '../systems'
import { trailing12MonthRounds } from '../../../shared/dashboard'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-dash-'))
  dirs.push(dir)
  return openTestDatabase(join(dir, 'test.db'))
}

function dayOffset(daysAgo: number, from: Date = new Date('2026-11-15T12:00:00')): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - daysAgo)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

test('trailing12MonthRounds: always 12 months ending current', () => {
  const now = new Date('2026-11-15T12:00:00')
  const months = trailing12MonthRounds(
    [
      { date: '2026-11-01', roundsFired: 100 },
      { date: '2026-10-15', roundsFired: 50 },
      { date: '2026-10-20', roundsFired: 25 }
    ],
    now
  )
  assert.equal(months.length, 12)
  assert.equal(months[11].key, '2026-11')
  assert.equal(months[11].rounds, 100)
  assert.equal(months[10].key, '2026-10')
  assert.equal(months[10].rounds, 75)
  assert.equal(months[0].key, '2025-12')
})

test('getDashboardSummary: KPIs, alerts, hides value when trackValue false', () => {
  const db = setup()
  ensureLocalProfile(db)
  updateProfile(db, { firstName: 'David', trackValue: true })

  const action = createPart(db, {
    manufacturer: 'Impact',
    type: 'Action',
    model: '737R',
    serialNumber: 'A1',
    value: 1400,
    maintenanceInterval: 500,
    roundsAfterCleaning: 480,
    totalRoundCount: 480
  })
  const barrel = createPart(db, {
    manufacturer: 'Proof',
    type: 'Barrel',
    name: 'Proof Match',
    caliber: '6.5 Creedmoor',
    gunsmith: 'S&S',
    value: 850,
    twistRate: 8,
    barrelLife: 3000,
    maintenanceInterval: 300,
    roundsAfterCleaning: 50,
    totalRoundCount: 1650
  })
  const chassis = createPart(db, {
    manufacturer: 'MDT',
    type: 'Chassis',
    model: 'ACC',
    value: 1200
  })
  const optic = createPart(db, {
    manufacturer: 'Vortex',
    type: 'Optic',
    model: 'Razor',
    serialNumber: 'O1',
    value: 3000
  })

  const system = createCustomSystem(db, {
    name: 'Match 6.5',
    platform: 'bolt_action',
    actionId: action.id,
    barrelId: barrel.id,
    chassisId: chassis.id,
    opticId: optic.id
  })

  const now = new Date('2026-11-15T12:00:00')
  addShootingLog(db, {
    systemId: system.id,
    date: dayOffset(2, now),
    location: 'Range A',
    roundsFired: 120,
    cartridge: '6.5 Creedmoor Match'
  })
  addShootingLog(db, {
    systemId: system.id,
    date: dayOffset(8, now),
    location: 'Range B',
    roundsFired: 80
  })

  addShootingLog(db, {
    systemId: system.id,
    date: dayOffset(1, now),
    location: 'PRS',
    roundsFired: 45,
    sessionType: 'Match',
    placement: 7,
    percentOfWinner: 88.5
  })

  const summary = getDashboardSummary(db)
  assert.equal(summary.firstName, 'David')
  assert.equal(summary.trackValue, true)
  assert.equal(summary.totalRounds, 245)
  assert.equal(summary.activeSystems, 1)
  assert.equal(summary.inventoryItems, 4)
  assert.equal(summary.totalValue, 1400 + 850 + 1200 + 3000)
  assert.ok(summary.monthlyRounds.length >= 1)
  assert.equal(summary.matchTrends.length, 1)
  assert.equal(summary.matchTrends[0].placement, 7)
  assert.equal(summary.matchTrends[0].percentOfWinner, 88.5)

  updateProfile(db, { trackValue: false, trackAmmo: false })
  const hidden = getDashboardSummary(db)
  assert.equal(hidden.trackValue, false)
  assert.equal(hidden.trackAmmo, false)
  assert.equal(hidden.ammoRoundsTotal, null)
})
