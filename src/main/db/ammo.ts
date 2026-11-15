/**
 * Ammo inventory CRUD + Move to Practice (software-spec §6.5, §7.3).
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
import type { AmmoInventory, AmmoType } from './types'

type AmmoRow = {
  id: string
  name: string
  type: AmmoType
  caliber: string
  quantity: number
  load_id: string | null
  manufacturer: string | null
  lot_number: string | null
  notes: string | null
  bullet_manufacturer: string | null
  bullet_type: string | null
  powder_manufacturer: string | null
  powder: string | null
  charge_weight: number | null
  primer_manufacturer: string | null
  primer: string | null
  case_manufacturer: string | null
  case_name: string | null
  seating_depth: string | null
  created_at: string
  updated_at: string
}

export type NewAmmoInput = {
  id?: string
  name: string
  type: AmmoType
  caliber: string
  quantity: number
  loadId?: string | null
  manufacturer?: string | null
  lotNumber?: string | null
  notes?: string | null
  bulletManufacturer?: string | null
  bulletType?: string | null
  powderManufacturer?: string | null
  powder?: string | null
  chargeWeight?: number | null
  primerManufacturer?: string | null
  primer?: string | null
  caseManufacturer?: string | null
  caseName?: string | null
  seatingDepth?: string | null
}

export type UpdateAmmoInput = Partial<Omit<NewAmmoInput, 'id'>>

function nowIso(): string {
  return new Date().toISOString()
}

function nullIfEmpty(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function mapAmmo(row: AmmoRow): AmmoInventory {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    caliber: row.caliber,
    quantity: row.quantity,
    loadId: row.load_id,
    manufacturer: row.manufacturer,
    lotNumber: row.lot_number,
    notes: row.notes,
    bulletManufacturer: row.bullet_manufacturer,
    bulletType: row.bullet_type,
    powderManufacturer: row.powder_manufacturer,
    powder: row.powder,
    chargeWeight: row.charge_weight,
    primerManufacturer: row.primer_manufacturer,
    primer: row.primer,
    caseManufacturer: row.case_manufacturer,
    caseName: row.case_name,
    seatingDepth: row.seating_depth,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function validateAmmo(input: {
  name?: string
  type?: AmmoType
  caliber?: string
  quantity?: number
  loadId?: string | null
}): void {
  if (input.name !== undefined && !input.name.trim()) {
    throw new Error('Ammo name is required')
  }
  if (input.caliber !== undefined && !input.caliber.trim()) {
    throw new Error('Cartridge is required')
  }
  if (input.type !== undefined && input.type !== 'Factory' && input.type !== 'Handload') {
    throw new Error('Ammo type must be Factory or Handload')
  }
  if (input.quantity !== undefined) {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new Error('Quantity must be greater than 0')
    }
    if (!Number.isInteger(input.quantity)) {
      throw new Error('Quantity must be a whole number')
    }
  }
}

function assertLoadExists(
  db: Database.Database,
  loadId: string | null | undefined,
  caliber: string
): void {
  if (!loadId) return
  const load = db.prepare(`SELECT id, caliber FROM load_developments WHERE id = ?`).get(loadId) as
    { id: string; caliber: string } | undefined
  if (!load) throw new Error(`Load recipe not found: ${loadId}`)
  if (load.caliber !== caliber) {
    throw new Error('Load recipe cartridge must match ammo cartridge')
  }
}

export function listAmmoInventory(db: Database.Database): AmmoInventory[] {
  const rows = db
    .prepare(`SELECT * FROM ammo_inventory ORDER BY caliber ASC, name ASC`)
    .all() as AmmoRow[]
  return rows.map(mapAmmo)
}

export function getAmmoInventory(db: Database.Database, id: string): AmmoInventory | null {
  const row = db.prepare(`SELECT * FROM ammo_inventory WHERE id = ?`).get(id) as AmmoRow | undefined
  return row ? mapAmmo(row) : null
}

export function createAmmoInventory(db: Database.Database, input: NewAmmoInput): AmmoInventory {
  validateAmmo({
    name: input.name,
    type: input.type,
    caliber: input.caliber,
    quantity: input.quantity
  })
  if (!input.name?.trim()) throw new Error('Ammo name is required')
  if (!input.caliber?.trim()) throw new Error('Cartridge is required')
  if (input.type !== 'Factory' && input.type !== 'Handload') {
    throw new Error('Ammo type must be Factory or Handload')
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error('Quantity must be greater than 0')
  }

  const caliber = input.caliber.trim()
  const type = input.type
  const loadId = type === 'Handload' ? (input.loadId ?? null) : null
  assertLoadExists(db, loadId, caliber)

  const id = input.id ?? randomUUID()
  const createdAt = nowIso()

  db.prepare(
    `INSERT INTO ammo_inventory (
      id, name, type, caliber, quantity, load_id, manufacturer, lot_number, notes,
      bullet_manufacturer, bullet_type, powder_manufacturer, powder, charge_weight,
      primer_manufacturer, primer, case_manufacturer, case_name, seating_depth,
      created_at, updated_at
    ) VALUES (
      @id, @name, @type, @caliber, @quantity, @loadId, @manufacturer, @lotNumber, @notes,
      @bulletManufacturer, @bulletType, @powderManufacturer, @powder, @chargeWeight,
      @primerManufacturer, @primer, @caseManufacturer, @caseName, @seatingDepth,
      @createdAt, @createdAt
    )`
  ).run({
    id,
    name: input.name.trim(),
    type,
    caliber,
    quantity: input.quantity,
    loadId,
    manufacturer: type === 'Factory' ? nullIfEmpty(input.manufacturer) : null,
    lotNumber: nullIfEmpty(input.lotNumber),
    notes: nullIfEmpty(input.notes),
    bulletManufacturer: nullIfEmpty(input.bulletManufacturer),
    bulletType: nullIfEmpty(input.bulletType),
    powderManufacturer: nullIfEmpty(input.powderManufacturer),
    powder: nullIfEmpty(input.powder),
    chargeWeight: input.chargeWeight ?? null,
    primerManufacturer: nullIfEmpty(input.primerManufacturer),
    primer: nullIfEmpty(input.primer),
    caseManufacturer: nullIfEmpty(input.caseManufacturer),
    caseName: nullIfEmpty(input.caseName),
    seatingDepth: nullIfEmpty(input.seatingDepth),
    createdAt
  })

  return getAmmoInventory(db, id)!
}

export function updateAmmoInventory(
  db: Database.Database,
  id: string,
  patch: UpdateAmmoInput
): AmmoInventory {
  const existing = getAmmoInventory(db, id)
  if (!existing) throw new Error(`Ammo inventory not found: ${id}`)

  const next = {
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    type: patch.type ?? existing.type,
    caliber: patch.caliber !== undefined ? patch.caliber.trim() : existing.caliber,
    quantity: patch.quantity ?? existing.quantity,
    loadId: patch.loadId !== undefined ? patch.loadId : existing.loadId,
    manufacturer: patch.manufacturer !== undefined ? patch.manufacturer : existing.manufacturer,
    lotNumber: patch.lotNumber !== undefined ? patch.lotNumber : existing.lotNumber,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    bulletManufacturer:
      patch.bulletManufacturer !== undefined
        ? patch.bulletManufacturer
        : existing.bulletManufacturer,
    bulletType: patch.bulletType !== undefined ? patch.bulletType : existing.bulletType,
    powderManufacturer:
      patch.powderManufacturer !== undefined
        ? patch.powderManufacturer
        : existing.powderManufacturer,
    powder: patch.powder !== undefined ? patch.powder : existing.powder,
    chargeWeight: patch.chargeWeight !== undefined ? patch.chargeWeight : existing.chargeWeight,
    primerManufacturer:
      patch.primerManufacturer !== undefined
        ? patch.primerManufacturer
        : existing.primerManufacturer,
    primer: patch.primer !== undefined ? patch.primer : existing.primer,
    caseManufacturer:
      patch.caseManufacturer !== undefined ? patch.caseManufacturer : existing.caseManufacturer,
    caseName: patch.caseName !== undefined ? patch.caseName : existing.caseName,
    seatingDepth: patch.seatingDepth !== undefined ? patch.seatingDepth : existing.seatingDepth
  }

  validateAmmo({
    name: next.name,
    type: next.type,
    caliber: next.caliber,
    quantity: next.quantity
  })

  const loadId = next.type === 'Handload' ? next.loadId : null
  assertLoadExists(db, loadId, next.caliber)

  const updatedAt = nowIso()
  db.prepare(
    `UPDATE ammo_inventory SET
      name = @name,
      type = @type,
      caliber = @caliber,
      quantity = @quantity,
      load_id = @loadId,
      manufacturer = @manufacturer,
      lot_number = @lotNumber,
      notes = @notes,
      bullet_manufacturer = @bulletManufacturer,
      bullet_type = @bulletType,
      powder_manufacturer = @powderManufacturer,
      powder = @powder,
      charge_weight = @chargeWeight,
      primer_manufacturer = @primerManufacturer,
      primer = @primer,
      case_manufacturer = @caseManufacturer,
      case_name = @caseName,
      seating_depth = @seatingDepth,
      updated_at = @updatedAt
    WHERE id = @id`
  ).run({
    id,
    name: next.name,
    type: next.type,
    caliber: next.caliber,
    quantity: next.quantity,
    loadId,
    manufacturer: next.type === 'Factory' ? nullIfEmpty(next.manufacturer) : null,
    lotNumber: nullIfEmpty(next.lotNumber),
    notes: nullIfEmpty(next.notes),
    bulletManufacturer: nullIfEmpty(next.bulletManufacturer),
    bulletType: nullIfEmpty(next.bulletType),
    powderManufacturer: nullIfEmpty(next.powderManufacturer),
    powder: nullIfEmpty(next.powder),
    chargeWeight: next.chargeWeight ?? null,
    primerManufacturer: nullIfEmpty(next.primerManufacturer),
    primer: nullIfEmpty(next.primer),
    caseManufacturer: nullIfEmpty(next.caseManufacturer),
    caseName: nullIfEmpty(next.caseName),
    seatingDepth: nullIfEmpty(next.seatingDepth),
    updatedAt
  })

  return getAmmoInventory(db, id)!
}

export function deleteAmmoInventory(db: Database.Database, id: string): void {
  const existing = getAmmoInventory(db, id)
  if (!existing) throw new Error(`Ammo inventory not found: ${id}`)
  db.prepare(`DELETE FROM ammo_inventory WHERE id = ?`).run(id)
}

/**
 * §7.3 — consolidate source ammo into a "Practice Ammo" lot for the same caliber.
 */
export function moveAmmoToPractice(db: Database.Database, sourceId: string): AmmoInventory {
  return db.transaction(() => {
    const source = getAmmoInventory(db, sourceId)
    if (!source) throw new Error(`Ammo inventory not found: ${sourceId}`)
    if (source.name === 'Practice Ammo') {
      throw new Error('Already Practice Ammo for this cartridge')
    }

    const practice = db
      .prepare(`SELECT * FROM ammo_inventory WHERE name = 'Practice Ammo' AND caliber = ? LIMIT 1`)
      .get(source.caliber) as AmmoRow | undefined

    const updatedAt = nowIso()

    if (practice) {
      const lotSuffix = source.lotNumber?.trim() ? ` (Lot: ${source.lotNumber.trim()})` : ''
      const additionNote = `Added ${source.quantity} rounds from ${source.name}${lotSuffix}`
      const nextNotes = practice.notes?.trim()
        ? `${practice.notes.trim()}\n${additionNote}`
        : additionNote

      db.prepare(
        `UPDATE ammo_inventory SET quantity = ?, notes = ?, updated_at = ? WHERE id = ?`
      ).run(practice.quantity + source.quantity, nextNotes, updatedAt, practice.id)
      db.prepare(`DELETE FROM ammo_inventory WHERE id = ?`).run(sourceId)
      return getAmmoInventory(db, practice.id)!
    }

    const notes = nullIfEmpty(source.notes) ?? `Created from ${source.name}`
    const id = randomUUID()
    const createdAt = updatedAt

    db.prepare(
      `INSERT INTO ammo_inventory (
        id, name, type, caliber, quantity, load_id, manufacturer, lot_number, notes,
        bullet_manufacturer, bullet_type, powder_manufacturer, powder, charge_weight,
        primer_manufacturer, primer, case_manufacturer, case_name, seating_depth,
        created_at, updated_at
      ) VALUES (
        @id, 'Practice Ammo', @type, @caliber, @quantity, @loadId, @manufacturer, '', @notes,
        @bulletManufacturer, @bulletType, @powderManufacturer, @powder, @chargeWeight,
        @primerManufacturer, @primer, @caseManufacturer, @caseName, @seatingDepth,
        @createdAt, @createdAt
      )`
    ).run({
      id,
      type: source.type,
      caliber: source.caliber,
      quantity: source.quantity,
      loadId: source.loadId,
      manufacturer: source.manufacturer,
      notes,
      bulletManufacturer: source.bulletManufacturer,
      bulletType: source.bulletType,
      powderManufacturer: source.powderManufacturer,
      powder: source.powder,
      chargeWeight: source.chargeWeight,
      primerManufacturer: source.primerManufacturer,
      primer: source.primer,
      caseManufacturer: source.caseManufacturer,
      caseName: source.caseName,
      seatingDepth: source.seatingDepth,
      createdAt
    })
    db.prepare(`DELETE FROM ammo_inventory WHERE id = ?`).run(sourceId)
    return getAmmoInventory(db, id)!
  })()
}
