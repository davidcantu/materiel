/**
 * Parse a Materiel Excel workbook (export or sample template) into MaterielImportDocument.
 */

import ExcelJS from 'exceljs'
import { EXCEL_SHEET } from '../../shared/excel'
import type {
  MaterielImportAmmo,
  MaterielImportBuild,
  MaterielImportDocument,
  MaterielImportLog,
  MaterielImportPart
} from '../../shared/import'
import { MATERIEL_IMPORT_VERSION } from '../../shared/import'
import type { PartType } from '../../shared/parts'
import type { Platform } from '../../shared/platforms'
import type { SessionType } from '../../shared/shooting-logs'

type HeaderMap = Map<string, number>

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim()
  }
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim()
    if ('result' in value && value.result != null) return cellText(value.result as ExcelJS.CellValue)
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join('').trim()
    }
  }
  return String(value).trim()
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  const text = cellText(value)
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function headerMap(row: ExcelJS.Row): HeaderMap {
  const map: HeaderMap = new Map()
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const key = cellText(cell.value)
    if (key) map.set(key, col)
  })
  return map
}

function col(map: HeaderMap, header: string): number | undefined {
  return map.get(header)
}

function getText(row: ExcelJS.Row, map: HeaderMap, header: string): string {
  const c = col(map, header)
  if (!c) return ''
  return cellText(row.getCell(c).value)
}

function getNumber(row: ExcelJS.Row, map: HeaderMap, header: string): number | null {
  const c = col(map, header)
  if (!c) return null
  return cellNumber(row.getCell(c).value)
}

function parsePlatforms(raw: string): Platform[] | undefined {
  if (!raw.trim()) return undefined
  const parts = raw.split(/[,;|]/).map((p) => p.trim()).filter(Boolean)
  const platforms = parts.filter(
    (p): p is Platform => p === 'bolt_action' || p === 'ar_pattern' || p === 'pistol'
  )
  return platforms.length ? platforms : undefined
}

function requireHeaders(map: HeaderMap, required: readonly string[], sheet: string): void {
  const missing = required.filter((h) => !map.has(h))
  if (missing.length) {
    throw new Error(`${sheet} sheet is missing columns: ${missing.join(', ')}`)
  }
}

function parseInventory(sheet: ExcelJS.Worksheet): MaterielImportPart[] {
  const map = headerMap(sheet.getRow(1))
  requireHeaders(map, ['ID', 'Type', 'Manufacturer'], EXCEL_SHEET.inventory)
  const parts: MaterielImportPart[] = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const id = getText(row, map, 'ID')
    const type = getText(row, map, 'Type')
    const manufacturer = getText(row, map, 'Manufacturer')
    if (!id && !type && !manufacturer) continue
    if (!id || !type || !manufacturer) {
      throw new Error(`Inventory row ${r}: ID, Type, and Manufacturer are required`)
    }
    parts.push({
      id,
      type: type as PartType,
      manufacturer,
      model: getText(row, map, 'Model') || null,
      name: getText(row, map, 'Name') || null,
      caliber: getText(row, map, 'Cartridge') || null,
      serialNumber: getText(row, map, 'Serial') || null,
      platforms: parsePlatforms(getText(row, map, 'Platforms')),
      totalRoundCount: getNumber(row, map, 'Lifetime rounds') ?? undefined,
      roundsAfterCleaning: getNumber(row, map, 'Rounds since clean') ?? undefined,
      maintenanceInterval: getNumber(row, map, 'Maint. interval'),
      barrelLife: getNumber(row, map, 'Barrel life'),
      twistRate: getNumber(row, map, 'Twist'),
      gunsmith: getText(row, map, 'Gunsmith') || null,
      value: getNumber(row, map, 'Value') ?? undefined,
      notes: getText(row, map, 'Notes') || null
    })
  }
  return parts
}

function parseBuilds(sheet: ExcelJS.Worksheet): MaterielImportBuild[] {
  const map = headerMap(sheet.getRow(1))
  requireHeaders(map, ['Name', 'Action/Primary', 'Barrel'], EXCEL_SHEET.builds)
  const builds: MaterielImportBuild[] = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const name = getText(row, map, 'Name')
    const actionId = getText(row, map, 'Action/Primary')
    const barrelId = getText(row, map, 'Barrel')
    if (!name && !actionId && !barrelId) continue
    if (!name || !actionId || !barrelId) {
      throw new Error(`Builds row ${r}: Name, Action/Primary, and Barrel are required`)
    }
    const platformRaw = getText(row, map, 'Platform')
    builds.push({
      id: getText(row, map, 'ID') || undefined,
      name,
      platform:
        platformRaw === 'bolt_action' || platformRaw === 'ar_pattern' || platformRaw === 'pistol'
          ? platformRaw
          : undefined,
      actionId,
      barrelId,
      chassisId: getText(row, map, 'Chassis/Furniture') || undefined,
      opticId: getText(row, map, 'Optic') || undefined,
      suppressorId: getText(row, map, 'Suppressor') || undefined,
      notes: getText(row, map, 'Notes') || null
    })
  }
  return builds
}

function parseLogs(sheet: ExcelJS.Worksheet): MaterielImportLog[] {
  const map = headerMap(sheet.getRow(1))
  requireHeaders(map, ['Date', 'Location', 'Rounds'], EXCEL_SHEET.logs)
  const logs: MaterielImportLog[] = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const date = getText(row, map, 'Date')
    const location = getText(row, map, 'Location')
    const rounds = getNumber(row, map, 'Rounds')
    const buildId = getText(row, map, 'Build ID')
    const barrelId = getText(row, map, 'Barrel ID')
    if (!date && !location && rounds == null && !buildId) continue
    if (!date || !location || rounds == null) {
      throw new Error(`Logs row ${r}: Date, Location, and Rounds are required`)
    }
    if (!buildId && !barrelId) {
      throw new Error(`Logs row ${r}: Build ID (or Barrel ID with a matching build) is required`)
    }
    const sessionRaw = getText(row, map, 'Session')
    const sessionType: SessionType = sessionRaw === 'Match' ? 'Match' : 'Practice'
    logs.push({
      buildId: buildId || undefined,
      barrelId: barrelId || undefined,
      date,
      location,
      roundsFired: rounds,
      sessionType,
      cartridge: getText(row, map, 'Cartridge') || null,
      velocity: getNumber(row, map, 'Velocity'),
      placement: getNumber(row, map, 'Place'),
      percentOfWinner: getNumber(row, map, '% of Winner'),
      notes: getText(row, map, 'Notes') || null
    })
  }
  return logs
}

function parseAmmo(sheet: ExcelJS.Worksheet): MaterielImportAmmo[] {
  const map = headerMap(sheet.getRow(1))
  requireHeaders(map, ['Type', 'Cartridge', 'Qty', 'Acquired'], EXCEL_SHEET.ammo)
  const ammo: MaterielImportAmmo[] = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const type = getText(row, map, 'Type')
    const caliber = getText(row, map, 'Cartridge')
    const qty = getNumber(row, map, 'Qty')
    const acquired = getText(row, map, 'Acquired')
    if (!type && !caliber && qty == null && !acquired) continue
    if (!type || !caliber || qty == null || !acquired) {
      throw new Error(`Ammo row ${r}: Type, Cartridge, Qty, and Acquired are required`)
    }
    if (type !== 'Factory' && type !== 'Handload') {
      throw new Error(`Ammo row ${r}: Type must be Factory or Handload`)
    }
    ammo.push({
      id: getText(row, map, 'ID') || undefined,
      name: getText(row, map, 'Label') || undefined,
      type,
      caliber,
      quantity: qty,
      acquiredDate: acquired,
      manufacturer: getText(row, map, 'Manufacturer') || null,
      lotNumber: getText(row, map, 'Lot') || null,
      bulletManufacturer: getText(row, map, 'Bullet mfr') || null,
      powderManufacturer: getText(row, map, 'Powder mfr') || null,
      primerManufacturer: getText(row, map, 'Primer mfr') || null,
      caseManufacturer: getText(row, map, 'Case mfr') || null,
      notes: getText(row, map, 'Notes') || null
    })
  }
  return ammo
}

export async function materielDocumentFromExcelBuffer(
  buffer: Buffer
): Promise<MaterielImportDocument> {
  const workbook = new ExcelJS.Workbook()
  // exceljs typings accept Buffer in Node.
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)

  const inventory = workbook.getWorksheet(EXCEL_SHEET.inventory)
  if (!inventory) {
    throw new Error(`Workbook must include an "${EXCEL_SHEET.inventory}" sheet`)
  }
  const parts = parseInventory(inventory)
  if (parts.length === 0) {
    throw new Error('Inventory sheet has no data rows')
  }

  const buildsSheet = workbook.getWorksheet(EXCEL_SHEET.builds)
  const logsSheet = workbook.getWorksheet(EXCEL_SHEET.logs)
  const ammoSheet = workbook.getWorksheet(EXCEL_SHEET.ammo)

  return {
    version: MATERIEL_IMPORT_VERSION,
    options: {
      createPlaceholderChassis: true,
      autoPairBuilds: false,
      defaultPlatform: 'bolt_action'
    },
    parts,
    builds: buildsSheet ? parseBuilds(buildsSheet) : [],
    logs: logsSheet ? parseLogs(logsSheet) : [],
    ammo: ammoSheet ? parseAmmo(ammoSheet) : []
  }
}
