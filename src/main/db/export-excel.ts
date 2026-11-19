/**
 * Multi-sheet Excel export for Materiel (inventory, builds, logs, round counts, summary).
 */

import ExcelJS from 'exceljs'
import type Database from 'better-sqlite3-multiple-ciphers'
import { listAmmoInventory } from './ammo'
import { listParts } from './parts'
import { ensureLocalProfile } from './profile'
import { listShootingLogs } from './shooting-logs'
import { listSystems } from './systems'

const BRAND_OD = '556B2F'
const BRAND_OD_DEEP = '4B5320'
const BRAND_SAND = 'C4B896'
const BRAND_TEXT = '2F3520'
const BRAND_MUTED = '5C6348'
const SURFACE = 'F4F1E8'
const WHITE = 'FFFFFF'

type YearRounds = { year: number; rounds: number }

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

function yearFromDate(isoDate: string): number | null {
  const m = /^(\d{4})/.exec(isoDate)
  return m ? Number(m[1]) : null
}

function aggregateYearlyRounds(logs: ReturnType<typeof listShootingLogs>): YearRounds[] {
  const map = new Map<number, number>()
  for (const log of logs) {
    const year = yearFromDate(log.date)
    if (year == null) continue
    map.set(year, (map.get(year) ?? 0) + log.roundsFired)
  }
  return [...map.entries()]
    .map(([year, rounds]) => ({ year, rounds }))
    .sort((a, b) => a.year - b.year)
}

function partLabel(part: {
  type: string
  manufacturer: string
  model: string | null
  name: string | null
  caliber: string | null
}): string {
  if (part.type === 'Barrel') {
    return part.name || [part.manufacturer, part.caliber].filter(Boolean).join(' ')
  }
  return [part.manufacturer, part.model].filter(Boolean).join(' ') || part.manufacturer
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  data: {
    profileName: string
    exportedAt: string
    partCount: number
    buildCount: number
    logCount: number
    lifetimeFromLogs: number
    lifetimeFromParts: number
    thisYearRounds: number
    yearly: YearRounds[]
    topBarrels: Array<{ label: string; rounds: number; life: number | null }>
  }
): void {
  const sheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: `FF${BRAND_OD}` } },
    views: [{ showGridLines: false }]
  })

  // Banner
  sheet.mergeCells('B2:H2')
  const title = sheet.getCell('B2')
  title.value = 'MATERIEL'
  title.font = { name: 'Arial Black', size: 28, color: { argb: `FF${WHITE}` }, bold: true }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_OD_DEEP}` } }
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  sheet.getRow(2).height = 44

  sheet.mergeCells('B3:H3')
  const subtitle = sheet.getCell('B3')
  subtitle.value = `Export snapshot · ${data.exportedAt}${data.profileName ? ` · ${data.profileName}` : ''}`
  subtitle.font = { name: 'Calibri', size: 11, color: { argb: `FF${BRAND_TEXT}` }, italic: true }
  subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_SAND}` } }
  sheet.getRow(3).height = 20

  // KPI cards
  const kpis: Array<{ cell: string; label: string; value: number | string }> = [
    { cell: 'B5', label: 'LIFETIME ROUNDS (LOGS)', value: data.lifetimeFromLogs },
    { cell: 'D5', label: 'THIS YEAR', value: data.thisYearRounds },
    { cell: 'F5', label: 'BUILDS', value: data.buildCount },
    { cell: 'H5', label: 'INVENTORY PARTS', value: data.partCount }
  ]

  for (const kpi of kpis) {
    const col = kpi.cell[0]!
    const labelCell = sheet.getCell(`${col}5`)
    const valueCell = sheet.getCell(`${col}6`)
    sheet.mergeCells(`${col}5:${String.fromCharCode(col.charCodeAt(0) + 1)}5`)
    sheet.mergeCells(`${col}6:${String.fromCharCode(col.charCodeAt(0) + 1)}6`)

    labelCell.value = kpi.label
    labelCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: `FF${BRAND_MUTED}` } }
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${SURFACE}` } }
    labelCell.alignment = { horizontal: 'left', vertical: 'bottom', indent: 1 }

    valueCell.value = kpi.value
    valueCell.font = { name: 'Calibri', size: 22, bold: true, color: { argb: `FF${BRAND_OD_DEEP}` } }
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${SURFACE}` } }
    valueCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    sheet.getRow(6).height = 36
  }

  sheet.getCell('B8').value = 'Rounds by calendar year'
  sheet.getCell('B8').font = { bold: true, size: 14, color: { argb: `FF${BRAND_OD_DEEP}` } }

  sheet.getCell('B9').value = 'Year'
  sheet.getCell('C9').value = 'Rounds'
  sheet.getCell('D9').value = 'Share of peak year'
  styleHeaderRow(sheet.getRow(9))
  ;['B', 'C', 'D'].forEach((c) => {
    sheet.getCell(`${c}9`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${BRAND_OD}` }
    }
    sheet.getCell(`${c}9`).font = { bold: true, color: { argb: `FF${WHITE}` } }
  })

  const maxYearRounds = Math.max(1, ...data.yearly.map((y) => y.rounds))
  const barMaxCols = 12
  data.yearly.forEach((row, index) => {
    const r = 10 + index
    sheet.getCell(`B${r}`).value = row.year
    sheet.getCell(`C${r}`).value = row.rounds
    sheet.getCell(`C${r}`).numFmt = '#,##0'
    const blocks = Math.max(1, Math.round((row.rounds / maxYearRounds) * barMaxCols))
    // Paint a simple bar across columns E…
    for (let i = 0; i < barMaxCols; i++) {
      const cell = sheet.getCell(r, 5 + i)
      if (i < blocks) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${i < blocks - 1 || blocks === 1 ? BRAND_OD : BRAND_OD_DEEP}` }
        }
      } else {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${SURFACE}` }
        }
      }
      cell.border = {
        top: { style: 'thin', color: { argb: `FF${WHITE}` } },
        bottom: { style: 'thin', color: { argb: `FF${WHITE}` } }
      }
    }
    sheet.getCell(`D${r}`).value = row.rounds / maxYearRounds
    sheet.getCell(`D${r}`).numFmt = '0%'
  })

  const topStart = 10 + data.yearly.length + 2
  sheet.getCell(`B${topStart}`).value = 'Top barrels by lifetime rounds'
  sheet.getCell(`B${topStart}`).font = {
    bold: true,
    size: 14,
    color: { argb: `FF${BRAND_OD_DEEP}` }
  }

  const headerRow = topStart + 1
  sheet.getCell(`B${headerRow}`).value = 'Barrel'
  sheet.getCell(`C${headerRow}`).value = 'Lifetime rounds'
  sheet.getCell(`D${headerRow}`).value = 'Barrel life'
  sheet.getCell(`E${headerRow}`).value = 'Life used'
  styleHeaderRow(sheet.getRow(headerRow))
  ;['B', 'C', 'D', 'E'].forEach((c) => {
    sheet.getCell(`${c}${headerRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${BRAND_OD}` }
    }
    sheet.getCell(`${c}${headerRow}`).font = { bold: true, color: { argb: `FF${WHITE}` } }
  })

  data.topBarrels.forEach((barrel, index) => {
    const r = headerRow + 1 + index
    sheet.getCell(`B${r}`).value = barrel.label
    sheet.getCell(`C${r}`).value = barrel.rounds
    sheet.getCell(`C${r}`).numFmt = '#,##0'
    sheet.getCell(`D${r}`).value = barrel.life ?? '—'
    if (barrel.life && barrel.life > 0) {
      sheet.getCell(`E${r}`).value = barrel.rounds / barrel.life
      sheet.getCell(`E${r}`).numFmt = '0.0%'
    } else {
      sheet.getCell(`E${r}`).value = '—'
    }
  })

  sheet.getCell('B5').note =
    'Lifetime rounds from session logs. Part lifetime counters may differ if logs were edited or parts imported with seed counts.'

  sheet.getColumn(2).width = 28
  sheet.getColumn(3).width = 14
  sheet.getColumn(4).width = 14
  sheet.getColumn(5).width = 3
  for (let i = 6; i <= 16; i++) sheet.getColumn(i).width = 3
}

function addInventorySheet(workbook: ExcelJS.Workbook, parts: ReturnType<typeof listParts>): void {
  const sheet = workbook.addWorksheet('Inventory', {
    properties: { tabColor: { argb: `FF${BRAND_SAND}` } }
  })
  const headers = [
    'ID',
    'Type',
    'Platforms',
    'Manufacturer',
    'Model',
    'Name',
    'Cartridge',
    'Serial',
    'Status',
    'Lifetime rounds',
    'Rounds since clean',
    'Maint. interval',
    'Barrel life',
    'Twist',
    'Gunsmith',
    'Value',
    'Notes'
  ]
  sheet.addRow(headers)
  styleHeaderRow(sheet.getRow(1))
  for (const part of parts) {
    sheet.addRow([
      part.id,
      part.type,
      part.platforms.join(', '),
      part.manufacturer,
      part.model,
      part.name,
      part.caliber,
      part.serialNumber,
      part.status,
      part.totalRoundCount,
      part.roundsAfterCleaning,
      part.maintenanceInterval,
      part.barrelLife,
      part.twistRate,
      part.gunsmith,
      part.value,
      part.notes
    ])
  }
  autosize(sheet)
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length }
  }
}

function addBuildsSheet(workbook: ExcelJS.Workbook, systems: ReturnType<typeof listSystems>): void {
  const sheet = workbook.addWorksheet('Builds')
  const headers = [
    'ID',
    'Name',
    'Type',
    'Platform',
    'Action/Primary',
    'Barrel',
    'Chassis/Furniture',
    'Optic',
    'Suppressor',
    'Factory mfr',
    'Factory model',
    'Factory cartridge',
    'Notes'
  ]
  sheet.addRow(headers)
  styleHeaderRow(sheet.getRow(1))
  for (const system of systems) {
    sheet.addRow([
      system.id,
      system.name,
      system.buildType,
      system.platform,
      system.actionId,
      system.barrelId,
      system.chassisId,
      system.opticId,
      system.suppressorId,
      system.factoryManufacturer,
      system.factoryModel,
      system.factoryCartridge,
      system.notes
    ])
  }
  autosize(sheet)
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

function addLogsSheet(workbook: ExcelJS.Workbook, logs: ReturnType<typeof listShootingLogs>): void {
  const sheet = workbook.addWorksheet('Logs', {
    properties: { tabColor: { argb: `FF${BRAND_OD}` } }
  })
  const headers = [
    'ID',
    'Date',
    'Year',
    'Build ID',
    'Barrel ID',
    'Location',
    'Rounds',
    'Session',
    'Cartridge',
    'Velocity',
    'Place',
    '% of Winner',
    'Ammo ID',
    'Notes'
  ]
  sheet.addRow(headers)
  styleHeaderRow(sheet.getRow(1))
  for (const log of logs) {
    sheet.addRow([
      log.id,
      log.date,
      yearFromDate(log.date),
      log.systemId,
      log.barrelId,
      log.location,
      log.roundsFired,
      log.sessionType,
      log.cartridge,
      log.velocity,
      log.placement,
      log.percentOfWinner,
      log.ammoId,
      log.notes
    ])
  }
  autosize(sheet)
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length }
  }
}

function addRoundCountsSheet(
  workbook: ExcelJS.Workbook,
  parts: ReturnType<typeof listParts>,
  yearly: YearRounds[],
  lifetimeFromLogs: number
): void {
  const sheet = workbook.addWorksheet('Round Counts')
  sheet.getCell('A1').value = 'Lifetime rounds by part (wear / tracked components)'
  sheet.getCell('A1').font = { bold: true, size: 13, color: { argb: `FF${BRAND_OD_DEEP}` } }
  sheet.mergeCells('A1:F1')

  const headers = [
    'Part ID',
    'Type',
    'Label',
    'Lifetime rounds',
    'Rounds since cleaning',
    'Barrel life'
  ]
  sheet.addRow([])
  const headerRow = sheet.addRow(headers)
  styleHeaderRow(headerRow)

  const tracked = parts
    .filter((p) =>
      ['Action', 'Barrel', 'Suppressor', 'BCG', 'Pistol', 'Lower', 'Trigger'].includes(p.type)
    )
    .sort((a, b) => b.totalRoundCount - a.totalRoundCount)

  for (const part of tracked) {
    sheet.addRow([
      part.id,
      part.type,
      partLabel(part),
      part.totalRoundCount,
      part.roundsAfterCleaning,
      part.barrelLife
    ])
  }

  const gap = sheet.rowCount + 2
  sheet.getCell(`A${gap}`).value = 'Yearly totals (from session logs)'
  sheet.getCell(`A${gap}`).font = { bold: true, size: 13, color: { argb: `FF${BRAND_OD_DEEP}` } }
  const yearHeader = sheet.addRow(['Year', 'Rounds fired'])
  styleHeaderRow(yearHeader)
  for (const row of yearly) {
    sheet.addRow([row.year, row.rounds])
  }
  sheet.addRow(['Lifetime (all logs)', lifetimeFromLogs])
  autosize(sheet)
  sheet.views = [{ state: 'frozen', ySplit: 3 }]
}

function addAmmoSheet(workbook: ExcelJS.Workbook, ammo: ReturnType<typeof listAmmoInventory>): void {
  const sheet = workbook.addWorksheet('Ammo')
  const headers = [
    'ID',
    'Label',
    'Type',
    'Cartridge',
    'Qty',
    'Acquired',
    'Manufacturer',
    'Lot',
    'Bullet mfr',
    'Powder mfr',
    'Primer mfr',
    'Case mfr',
    'Notes'
  ]
  sheet.addRow(headers)
  styleHeaderRow(sheet.getRow(1))
  for (const lot of ammo) {
    sheet.addRow([
      lot.id,
      lot.name,
      lot.type,
      lot.caliber,
      lot.quantity,
      lot.acquiredDate,
      lot.manufacturer,
      lot.lotNumber,
      lot.bulletManufacturer,
      lot.powderManufacturer,
      lot.primerManufacturer,
      lot.caseManufacturer,
      lot.notes
    ])
  }
  autosize(sheet)
}

export async function buildMaterielExcelBuffer(db: Database.Database): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Materiel'
  workbook.created = new Date()
  workbook.modified = new Date()

  const profile = ensureLocalProfile(db)
  const parts = listParts(db)
  const systems = listSystems(db)
  const logs = listShootingLogs(db)
  const ammo = listAmmoInventory(db)
  const yearly = aggregateYearlyRounds(logs)
  const lifetimeFromLogs = logs.reduce((sum, log) => sum + log.roundsFired, 0)
  const lifetimeFromParts = parts.reduce((sum, part) => sum + part.totalRoundCount, 0)
  const thisYear = new Date().getFullYear()
  const thisYearRounds = yearly.find((y) => y.year === thisYear)?.rounds ?? 0

  const topBarrels = parts
    .filter((p) => p.type === 'Barrel')
    .sort((a, b) => b.totalRoundCount - a.totalRoundCount)
    .slice(0, 8)
    .map((p) => ({
      label: partLabel(p),
      rounds: p.totalRoundCount,
      life: p.barrelLife
    }))

  const profileName =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || ''
  const exportedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')

  addSummarySheet(workbook, {
    profileName,
    exportedAt,
    partCount: parts.length,
    buildCount: systems.length,
    logCount: logs.length,
    lifetimeFromLogs,
    lifetimeFromParts,
    thisYearRounds,
    yearly,
    topBarrels
  })
  addInventorySheet(workbook, parts)
  addBuildsSheet(workbook, systems)
  addLogsSheet(workbook, logs)
  addRoundCountsSheet(workbook, parts, yearly, lifetimeFromLogs)
  addAmmoSheet(workbook, ammo)

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
