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
  assert.equal(summary.milestones.length, 6)
  assert.equal(summary.unlockedCount, 0)
  for (const m of summary.milestones) {
    assert.equal(m.unlocked, false)
  }
})

test('evaluateMilestones: each §7.5 rule unlocks independently', () => {
  assert.equal(byId(evaluateMilestones(emptySnapshot({ systemCount: 1 })), 'iron-sights'), true)
  assert.equal(byId(evaluateMilestones(emptySnapshot({ totalRounds: 999 })), 'round-junkie'), false)
  assert.equal(byId(evaluateMilestones(emptySnapshot({ totalRounds: 1000 })), 'round-junkie'), true)
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ matchSessionCount: 5 })), 'match-ready'),
    true
  )
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ hasHandloadAmmo: true })), 'handloader'),
    true
  )
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ maxBarrelRounds: 2500 })), 'barrel-burner'),
    true
  )
  assert.equal(
    byId(evaluateMilestones(emptySnapshot({ ownedPartTypes: [...PART_TYPES] })), 'full-kit'),
    true
  )
  assert.equal(
    byId(
      evaluateMilestones(
        emptySnapshot({
          ownedPartTypes: ['Action', 'Barrel', 'Chassis', 'Optic', 'Suppressor', 'Misc']
        })
      ),
      'full-kit'
    ),
    false
  )
  assert.equal(
    byId(
      evaluateMilestones(
        emptySnapshot({
          ownedPartTypes: [
            'Action',
            'Barrel',
            'Chassis',
            'Optic',
            'LaserIR',
            'Suppressor',
            'Trigger',
            'Misc'
          ]
        })
      ),
      'full-kit'
    ),
    true
  )
})

test('getMilestonesSummary: derives unlocks from DB rows', () => {
  const db = setup()

  let summary = getMilestonesSummary(db)
  assert.equal(summary.unlockedCount, 0)

  const action = createPart(db, {
    manufacturer: 'Impact',
    type: 'Action',
    model: '737R',
    serialNumber: 'A1'
  })
  const barrel = createPart(db, {
    manufacturer: 'Proof',
    type: 'Barrel',
    name: 'Proof GT',
    caliber: '6mm GT',
    gunsmith: 'Altus',
    twistRate: 7.5,
    totalRoundCount: 2500
  })
  const chassis = createPart(db, {
    manufacturer: 'Manners',
    type: 'Chassis',
    model: 'TCS'
  })
  const optic = createPart(db, {
    manufacturer: 'Nightforce',
    type: 'Optic',
    model: 'ATACR',
    serialNumber: 'O1'
  })
  createPart(db, {
    manufacturer: 'Thunder Beast',
    type: 'Suppressor',
    model: 'Ultra 7',
    muzzleType: 'Suppressor',
    serialNumber: 'TB-1'
  })
  createPart(db, {
    manufacturer: 'Wilcox',
    type: 'LaserIR',
    model: 'RAPTAR'
  })
  createPart(db, {
    manufacturer: 'TriggerTech',
    type: 'Trigger',
    model: 'Diamond'
  })
  createPart(db, {
    manufacturer: 'Area 419',
    type: 'Misc',
    model: 'Hellfire'
  })

  const system = createCustomSystem(db, {
    name: 'GT Match',
    platform: 'bolt_action',
    actionId: action.id,
    barrelId: barrel.id,
    chassisId: chassis.id,
    opticId: optic.id
  })

  createAmmoInventory(db, {
    name: 'Handload Lot',
    type: 'Handload',
    caliber: '6mm GT',
    quantity: 50,
    acquiredDate: '2026-11-01'
  })

  for (let i = 0; i < 5; i++) {
    addShootingLog(db, {
      systemId: system.id,
      date: `2026-11-${String(i + 1).padStart(2, '0')}`,
      location: 'Range',
      roundsFired: 200,
      sessionType: 'Match'
    })
  }

  summary = getMilestonesSummary(db)
  assert.equal(summary.unlockedCount, 6)
  for (const m of summary.milestones) {
    assert.equal(m.unlocked, true, `${m.id} should be unlocked`)
  }
})
