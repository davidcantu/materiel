import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import { openTestDatabase } from '../connection'
import { createAmmoInventory } from '../ammo'
import { getMilestonesSummary } from '../milestones'
import { createPart } from '../parts'
import { addShootingLog } from '../shooting-logs'
import { createCustomSystem } from '../systems'
import { evaluateMilestones, type MilestoneSnapshot } from '../../../shared/milestones'
import { PART_TYPES } from '../../../shared/parts'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-miles-'))
  dirs.push(dir)
  return openTestDatabase(join(dir, 'test.db'))
}

function emptySnapshot(overrides: Partial<MilestoneSnapshot> = {}): MilestoneSnapshot {
  return {
    systemCount: 0,
    totalRounds: 0,
    matchSessionCount: 0,
    hasHandloadAmmo: false,
    maxBarrelRounds: 0,
    ownedPartTypes: [],
    bestMatchPlace: null,
    bestPercentOfWinner: null,
    ...overrides
  }
}

function byId(summary: ReturnType<typeof evaluateMilestones>, id: string): boolean {
  const row = summary.milestones.find((m) => m.id === id)
  assert.ok(row, `missing milestone ${id}`)
  return row.unlocked
}

test('evaluateMilestones: all locked on empty snapshot', () => {
  const summary = evaluateMilestones(emptySnapshot())
  assert.equal(summary.milestones.length, 9)
  assert.equal(summary.unlockedCount, 0)
  for (const m of summary.milestones) {
    assert.equal(m.unlocked, false)
  }
})

test('evaluateMilestones: new / mid / advanced unlock rules', () => {
  assert.equal(byId(evaluateMilestones(emptySnapshot({ systemCount: 1 })), 'kit-up'), true)
  assert.equal(byId(evaluateMilestones(emptySnapshot({ totalRounds: 99 })), 'brass-rain'), false)
  assert.equal(byId(evaluateMilestones(emptySnapshot({ totalRounds: 100 })), 'brass-rain'), true)
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ matchSessionCount: 1 })), 'first-contact'),
    true
  )
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ totalRounds: 1000 })), 'ammo-budget-denial'),
    true
  )
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ matchSessionCount: 5 })), 'stage-captain-adjacent'),
    true
  )
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ hasHandloadAmmo: true })), 'kitchen-table-armorer'),
    true
  )
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ maxBarrelRounds: 2500 })), 'barrel-retirement'),
    true
  )
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ ownedPartTypes: [...PART_TYPES] })), 'full-battle-rattle'),
    true
  )
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ bestMatchPlace: 3 })), 'podium-threat'),
    true
  )
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ bestPercentOfWinner: 95 })), 'podium-threat'),
    true
  )
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ bestMatchPlace: 4, bestPercentOfWinner: 94.999 })), 'podium-threat'),
    false
  )
})

test('getMilestonesSummary: unlocks from DB state including podium', () => {
  const db = setup()
  try {
    const action = createPart(db, {
      manufacturer: 'Impact',
      type: 'Action',
      serialNumber: 'A1'
    })
    const barrel = createPart(db, {
      manufacturer: 'Proof',
      type: 'Barrel',
      name: 'Match',
      caliber: '6.5 Creedmoor',
      gunsmith: 'S&S',
      totalRoundCount: 2500
    })
    const chassis = createPart(db, {
      manufacturer: 'MDT',
      type: 'Chassis',
      model: 'ACC'
    })
    createCustomSystem(db, {
      name: 'PRS Gun',
      platform: 'bolt_action',
      actionId: action.id,
      barrelId: barrel.id,
      chassisId: chassis.id
    })

    createAmmoInventory(db, {
      type: 'Handload',
      caliber: '6.5 Creedmoor',
      quantity: 40,
      acquiredDate: '2026-01-01'
    })

    addShootingLog(db, {
      systemId: (db.prepare(`SELECT id FROM systems`).get() as { id: string }).id,
      date: '2026-11-01',
      location: 'Match',
      roundsFired: 100,
      sessionType: 'Match',
      placement: 2,
      percentOfWinner: 96.5
    })

    const summary = getMilestonesSummary(db)
    assert.ok(byId(summary, 'kit-up'))
    assert.ok(byId(summary, 'brass-rain'))
    assert.ok(byId(summary, 'first-contact'))
    assert.ok(byId(summary, 'kitchen-table-armorer'))
    assert.ok(byId(summary, 'podium-threat'))
  } finally {
    db.close()
  }
})
