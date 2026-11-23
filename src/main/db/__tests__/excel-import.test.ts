import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import { openTestDatabase } from '../connection'
import { materielDocumentFromExcelBuffer } from '../excel-import'
import { buildMaterielSampleExcelBuffer } from '../excel-template'
import { importMaterielDocument } from '../import-data'
import { listAmmoInventory } from '../ammo'
import { listParts } from '../parts'
import { listShootingLogs } from '../shooting-logs'
import { listSystems } from '../systems'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-excel-import-'))
  dirs.push(dir)
  return openTestDatabase(join(dir, 'test.db'))
}

describe('excel sample → import', () => {
  it('parses the sample workbook into a Materiel document', async () => {
    const buffer = await buildMaterielSampleExcelBuffer()
    const doc = await materielDocumentFromExcelBuffer(buffer)
    assert.equal(doc.version, 1)
    assert.ok(doc.parts.length >= 3)
    assert.ok((doc.builds?.length ?? 0) >= 1)
    assert.ok((doc.logs?.length ?? 0) >= 1)
    assert.ok((doc.ammo?.length ?? 0) >= 1)
    assert.ok(doc.parts.some((p) => p.type === 'Action'))
    assert.ok(doc.parts.some((p) => p.type === 'Barrel'))
  })

  it('imports sample workbook into an empty database', async () => {
    const db = setup()
    const buffer = await buildMaterielSampleExcelBuffer()
    const doc = await materielDocumentFromExcelBuffer(buffer)
    const result = importMaterielDocument(db, doc)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.ok(result.summary.partsCreated >= 3)
    assert.equal(result.summary.buildsCreated, 1)
    assert.equal(result.summary.logsCreated, 2)
    assert.equal(result.summary.ammoCreated, 1)
    assert.equal(listSystems(db).length, 1)
    assert.equal(listShootingLogs(db).length, 2)
    assert.equal(listAmmoInventory(db).length, 1)
    assert.ok(listParts(db).some((p) => p.id === 'act-sample-1'))
  })
})
