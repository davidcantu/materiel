import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import { openTestDatabase } from '../connection'
import { importMaterielDocument } from '../import-data'
import { listParts } from '../parts'
import { listSystems } from '../systems'
import { listShootingLogs } from '../shooting-logs'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-import-'))
  dirs.push(dir)
  return openTestDatabase(join(dir, 'test.db'))
}

describe('importMaterielDocument', () => {
  it('imports actions+barrels with placeholder chassis, builds, and logs', () => {
    const db = setup()
    const result = importMaterielDocument(db, {
      version: 1,
      options: {
        createPlaceholderChassis: true,
        autoPairBuilds: false,
        defaultPlatform: 'bolt_action'
      },
      parts: [
        {
          id: 'act-1',
          type: 'Action',
          manufacturer: 'Impact Precision',
          model: '737R',
          serialNumber: 'A-100'
        },
        {
          id: 'bar-1',
          type: 'Barrel',
          manufacturer: 'Proof Research',
          name: 'Proof 26 #1',
          caliber: '6.5 Creedmoor',
          gunsmith: 'S&S'
        }
      ],
      builds: [
        {
          id: 'build-1',
          name: 'Match 6.5',
          actionId: 'act-1',
          barrelId: 'bar-1'
        }
      ],
      logs: [
        {
          buildId: 'build-1',
          date: '2026-11-01',
          location: 'Local range',
          roundsFired: 20,
          sessionType: 'Practice'
        }
      ]
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.summary.partsCreated, 3) // action + barrel + placeholder chassis
    assert.equal(result.summary.buildsCreated, 1)
    assert.equal(result.summary.logsCreated, 1)
    assert.equal(result.summary.ammoCreated, 0)
    assert.equal(result.summary.placeholderChassisId, 'chassis-import-placeholder')

    const parts = listParts(db)
    assert.ok(parts.some((p) => p.id === 'chassis-import-placeholder' && p.type === 'Chassis'))
    assert.equal(listSystems(db).length, 1)
    assert.equal(listShootingLogs(db).length, 1)
    assert.equal(listShootingLogs(db)[0]?.roundsFired, 20)
  })

  it('auto-pairs actions and barrels when requested', () => {
    const db = setup()
    const result = importMaterielDocument(db, {
      version: 1,
      options: { autoPairBuilds: true, createPlaceholderChassis: true },
      parts: [
        { id: 'a1', type: 'Action', manufacturer: 'Defiance', model: 'Deviant', serialNumber: 'S1' },
        { id: 'a2', type: 'Action', manufacturer: 'Bighorn', model: 'TL3', serialNumber: 'S2' },
        {
          id: 'b1',
          type: 'Barrel',
          manufacturer: 'Krieger',
          caliber: '6mm GT',
          name: 'Krieger 6GT'
        },
        {
          id: 'b2',
          type: 'Barrel',
          manufacturer: 'Bartlein',
          caliber: '.308',
          name: 'Bartlein 308'
        }
      ]
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.summary.buildsCreated, 2)
    assert.equal(listSystems(db).length, 2)
  })

  it('rejects unsupported version', () => {
    const db = setup()
    const result = importMaterielDocument(db, { version: 99, parts: [] })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /version/i)
  })
})
