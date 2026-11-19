import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import ExcelJS from 'exceljs'
import type Database from 'better-sqlite3-multiple-ciphers'
import { openTestDatabase } from '../connection'
import { buildMaterielExcelBuffer } from '../export-excel'
import { createPart } from '../parts'
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
  const dir = mkdtempSync(join(tmpdir(), 'materiel-xlsx-'))
  dirs.push(dir)
  return openTestDatabase(join(dir, 'test.db'))
}

describe('buildMaterielExcelBuffer', () => {
  it('writes multi-sheet workbook with yearly and lifetime rounds', async () => {
    const db = setup()
    const action = createPart(db, {
      id: 'act-x',
      type: 'Action',
      manufacturer: 'Impact Precision',
      model: '737R',
      serialNumber: 'X1',
      platforms: ['bolt_action']
    })
    const barrel = createPart(db, {
      id: 'bar-x',
      type: 'Barrel',
      manufacturer: 'Proof',
      name: 'Proof 26',
      caliber: '6.5 Creedmoor',
      gunsmith: 'Shop',
      totalRoundCount: 500,
      platforms: ['bolt_action']
    })
    const chassis = createPart(db, {
      id: 'cha-x',
      type: 'Chassis',
      manufacturer: 'MDT',
      model: 'ACC',
      platforms: ['bolt_action']
    })
    const system = createCustomSystem(db, {
      id: 'sys-x',
      name: 'Export Rifle',
      platform: 'bolt_action',
      actionId: action.id,
      barrelId: barrel.id,
      chassisId: chassis.id
    })
    addShootingLog(db, {
      systemId: system.id,
      date: '2025-06-01',
      location: 'Range',
      roundsFired: 40,
      sessionType: 'Practice'
    })
    addShootingLog(db, {
      systemId: system.id,
      date: '2026-01-15',
      location: 'Range',
      roundsFired: 25,
      sessionType: 'Practice'
    })

    const buffer = await buildMaterielExcelBuffer(db)
    assert.ok(buffer.byteLength > 1000)

    const workbook = new ExcelJS.Workbook()
    // exceljs load accepts Buffer in Node
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)

    const names = workbook.worksheets.map((s) => s.name)
    assert.deepEqual(names, ['Summary', 'Inventory', 'Builds', 'Logs', 'Round Counts', 'Ammo'])

    const logs = workbook.getWorksheet('Logs')
    assert.ok(logs)
    assert.ok((logs.rowCount ?? 0) >= 3)

    const rounds = workbook.getWorksheet('Round Counts')
    assert.ok(rounds)
    const text = JSON.stringify(rounds.getSheetValues())
    assert.match(text, /2025/)
    assert.match(text, /2026/)
  })
})
