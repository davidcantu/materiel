/**
 * Sample Materiel Excel workbook for first-time spreadsheet import.
 * Headers match export / excel-import parsers.
 */

import ExcelJS from 'exceljs'
import {
  AMMO_HEADERS,
  BUILDS_HEADERS,
  EXCEL_SHEET,
  INVENTORY_HEADERS,
  LOGS_HEADERS
} from '../../shared/excel'

const BRAND_OD = '556B2F'
const BRAND_OD_DEEP = '4B5320'
const BRAND_SAND = 'C4B896'
const WHITE = 'FFFFFF'

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: `FF${WHITE}` }, name: 'Calibri', size: 11 }
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${BRAND_OD}` }
  }
  row.alignment = { vertical: 'middle', horizontal: 'left' }
  row.height = 22
}

function autosize(sheet: ExcelJS.Worksheet, min = 10, max = 42): void {
  sheet.columns.forEach((col) => {
    let width = min
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length
      width = Math.min(max, Math.max(width, len + 2))
    })
    col.width = width
  })
}

function addInstructions(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet(EXCEL_SHEET.instructions, {
    properties: { tabColor: { argb: `FF${BRAND_OD_DEEP}` } },
    views: [{ showGridLines: false }]
  })
  sheet.mergeCells('B2:G2')
  const title = sheet.getCell('B2')
  title.value = 'MATERIEL — sample import workbook'
  title.font = { name: 'Arial Black', size: 18, color: { argb: `FF${WHITE}` }, bold: true }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_OD_DEEP}` } }
  title.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(2).height = 36

  const lines = [
    'How to use',
    '1. Keep the Inventory / Builds / Logs / Ammo header row exactly as written (column names matter).',
    '2. Replace the sample rows with your data, or delete sample rows and add your own.',
    '3. Part IDs on Inventory must match Action/Primary, Barrel, Chassis/Furniture, Optic, and Suppressor cells on Builds.',
    '4. Log “Build ID” values must match Builds “ID” (or leave Build ID blank only if you also supply pairing elsewhere).',
    '5. Platforms: bolt_action, ar_pattern, or pistol (comma-separate on Inventory).',
    '6. Session on Logs: Practice or Match. Ammo Type: Factory or Handload.',
    '7. Dates: YYYY-MM-DD. Empty optional cells are fine.',
    '8. Summary and Round Counts sheets are ignored on import (export-only / derived).',
    '9. You can also re-import a Materiel Excel export — existing part/build/ammo IDs are reused; new rows are added.',
    '10. Google Sheets: File → Download → Microsoft Excel (.xlsx), then Import Excel in Materiel Settings.',
    '',
    'Minimum for a bolt rifle',
    '• Inventory: one Action (with Serial), one Barrel (Cartridge + Name), optional Chassis',
    '• Builds: Name + Action/Primary + Barrel (Chassis optional — Materiel can placeholder)',
    '• Logs: Date + Location + Rounds + Build ID'
  ]
  lines.forEach((line, i) => {
    const cell = sheet.getCell(`B${4 + i}`)
    cell.value = line
    cell.font = {
      name: 'Calibri',
      size: line.startsWith('How') || line.startsWith('Minimum') ? 13 : 11,
      bold: line.startsWith('How') || line.startsWith('Minimum'),
      color: { argb: `FF${BRAND_OD_DEEP}` }
    }
  })
  sheet.getColumn(2).width = 110
}

export async function buildMaterielSampleExcelBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Materiel'
  workbook.created = new Date()
  workbook.modified = new Date()

  addInstructions(workbook)

  const inventory = workbook.addWorksheet(EXCEL_SHEET.inventory, {
    properties: { tabColor: { argb: `FF${BRAND_SAND}` } }
  })
  inventory.addRow([...INVENTORY_HEADERS])
  styleHeaderRow(inventory.getRow(1))
  inventory.addRow([
    'act-sample-1',
    'Action',
    'bolt_action',
    'Impact Precision',
    '737R',
    null,
    null,
    'SAMPLE-ACT-001',
    'In Stock',
    0,
    0,
    null,
    null,
    null,
    null,
    null,
    'Sample action — replace me'
  ])
  inventory.addRow([
    'bar-sample-1',
    'Barrel',
    'bolt_action',
    'Proof Research',
    null,
    'Proof 26 #1',
    '6.5 Creedmoor',
    null,
    'In Stock',
    120,
    40,
    50,
    3000,
    8,
    'S&S',
    null,
    'Sample barrel — replace me'
  ])
  inventory.addRow([
    'chassis-sample-1',
    'Chassis',
    'bolt_action',
    'MDT',
    'ACC Elite',
    null,
    null,
    null,
    'In Stock',
    0,
    0,
    null,
    null,
    null,
    null,
    null,
    'Sample chassis'
  ])
  inventory.addRow([
    'optic-sample-1',
    'Optic',
    'bolt_action',
    'Nightforce',
    'ATACR 5-25',
    null,
    null,
    null,
    'In Stock',
    0,
    0,
    null,
    null,
    null,
    null,
    null,
    'Sample optic'
  ])
  autosize(inventory)
  inventory.views = [{ state: 'frozen', ySplit: 1 }]

  const builds = workbook.addWorksheet(EXCEL_SHEET.builds)
  builds.addRow([...BUILDS_HEADERS])
  styleHeaderRow(builds.getRow(1))
  builds.addRow([
    'build-sample-1',
    'Sample Match 6.5',
    'custom',
    'bolt_action',
    'act-sample-1',
    'bar-sample-1',
    'chassis-sample-1',
    'optic-sample-1',
    null,
    null,
    null,
    null,
    'Sample build — IDs must match Inventory'
  ])
  autosize(builds)
  builds.views = [{ state: 'frozen', ySplit: 1 }]

  const logs = workbook.addWorksheet(EXCEL_SHEET.logs, {
    properties: { tabColor: { argb: `FF${BRAND_OD}` } }
  })
  logs.addRow([...LOGS_HEADERS])
  styleHeaderRow(logs.getRow(1))
  logs.addRow([
    null,
    '2026-03-15',
    2026,
    'build-sample-1',
    'bar-sample-1',
    'Local range',
    20,
    'Practice',
    '6.5 Creedmoor',
    2720,
    null,
    null,
    null,
    'Sample session'
  ])
  logs.addRow([
    null,
    '2026-04-02',
    2026,
    'build-sample-1',
    'bar-sample-1',
    'Club match',
    48,
    'Match',
    '6.5 Creedmoor',
    null,
    3,
    92.5,
    null,
    'Sample match'
  ])
  autosize(logs)
  logs.views = [{ state: 'frozen', ySplit: 1 }]

  const ammo = workbook.addWorksheet(EXCEL_SHEET.ammo)
  ammo.addRow([...AMMO_HEADERS])
  styleHeaderRow(ammo.getRow(1))
  ammo.addRow([
    'ammo-sample-1',
    'Hornady ELD-M 140',
    'Factory',
    '6.5 Creedmoor',
    80,
    '2026-01-10',
    'Hornady',
    'LOT-SAMPLE',
    null,
    null,
    null,
    null,
    'Sample factory ammo'
  ])
  autosize(ammo)

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
