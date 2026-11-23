/**
 * Load development (reloading recipe) CRUD — software-spec §3.5 / §6.5.
 * Identity (cartridge, load name, date updated) is required; all else optional.
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
import { timestampFromIsoDate, todayIsoDate } from '../../shared/loads'
import type { LoadDevelopment } from './types'

type LoadRow = {
  id: string
  name: string
  caliber: string
  bullet_manufacturer: string
  bullet_model: string
  brass_manufacturer: string
  brass_model: string | null
  powder_manufacturer: string
  powder_model: string
  primer_manufacturer: string
  primer_model: string
  powder_charge: number | null
  coal: number | null
  shoulder_bump: number | null
  neck_tension: number | null
  lands: number | null
  cbto: number | null
  velocity: number | null
  sd: number | null
  es: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type NewLoadInput = {
  id?: string
  name: string
  caliber: string
  dateUpdated: string
  bulletManufacturer?: string | null
  bulletModel?: string | null
  brassManufacturer?: string | null
  brassModel?: string | null
  powderManufacturer?: string | null
  powderModel?: string | null
  primerManufacturer?: string | null
  primerModel?: string | null
  powderCharge?: number | null
  coal?: number | null
  shoulderBump?: number | null
  neckTension?: number | null
  lands?: number | null
  cbto?: number | null
  velocity?: number | null
  sd?: number | null
  es?: number | null
  notes?: string | null
}

export type UpdateLoadInput = Partial<Omit<NewLoadInput, 'id'>>

function nowIso(): string {
  return new Date().toISOString()
}

function emptyString(value: string | null | undefined): string {
  if (value == null) return ''
  return value.trim()
}

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = emptyString(value)
  return trimmed.length ? trimmed : null
}

function optionalNumber(
  value: number | null | undefined,
  label: string,
  opts?: { integer?: boolean; min?: number; allowZero?: boolean }
): number | null {
  if (value == null || (typeof value === 'number' && Number.isNaN(value))) return null
  if (!Number.isFinite(value)) throw new Error(`${label} must be a number`)
  if (opts?.integer && !Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number`)
  }
  const min = opts?.min ?? (opts?.allowZero ? 0 : undefined)
  if (min != null && value < min) {
    throw new Error(`${label} must be ≥ ${min}`)
  }
  return value
}

function requireIsoDate(value: string | undefined, label: string): string {
  const trimmed = value?.trim() ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${label} is required (YYYY-MM-DD)`)
  }
  return trimmed
}

function mapLoad(row: LoadRow): LoadDevelopment {
  return {
    id: row.id,
    name: row.name,
    caliber: row.caliber,
    bulletManufacturer: row.bullet_manufacturer,
    bulletModel: row.bullet_model,
    brassManufacturer: row.brass_manufacturer,
    brassModel: row.brass_model,
    powderManufacturer: row.powder_manufacturer,
    powderModel: row.powder_model,
    primerManufacturer: row.primer_manufacturer,
    primerModel: row.primer_model,
    powderCharge: row.powder_charge,
    coal: row.coal,
    shoulderBump: row.shoulder_bump,
    neckTension: row.neck_tension,
    lands: row.lands,
    cbto: row.cbto,
    velocity: row.velocity,
    sd: row.sd,
    es: row.es,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function requireTrimmed(value: string | undefined, label: string): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) throw new Error(`${label} is required`)
  return trimmed
}

export function listLoads(db: Database.Database): LoadDevelopment[] {
  const rows = db
    .prepare(`SELECT * FROM load_developments ORDER BY caliber ASC, name ASC`)
    .all() as LoadRow[]
  return rows.map(mapLoad)
}

export function getLoad(db: Database.Database, id: string): LoadDevelopment | null {
  const row = db.prepare(`SELECT * FROM load_developments WHERE id = ?`).get(id) as
    | LoadRow
    | undefined
  return row ? mapLoad(row) : null
}

export function createLoad(db: Database.Database, input: NewLoadInput): LoadDevelopment {
  const name = requireTrimmed(input.name, 'Load name')
  const caliber = requireTrimmed(input.caliber, 'Cartridge')
  const dateUpdated = requireIsoDate(input.dateUpdated ?? todayIsoDate(), 'Date updated')
  const updatedAt = timestampFromIsoDate(dateUpdated)
  const createdAt = nowIso()
  const id = input.id ?? randomUUID()

  const powderCharge = optionalNumber(input.powderCharge, 'Charge weight', { min: 0.1 })
  const shoulderBump = optionalNumber(input.shoulderBump, 'Shoulder bump', { allowZero: true })
  const neckTension = optionalNumber(input.neckTension, 'Neck tension', { allowZero: true })
  const lands = optionalNumber(input.lands, 'Lands', { min: 0 })
  const cbto = optionalNumber(input.cbto, 'CBTO', { min: 0 })
  const velocity = optionalNumber(input.velocity, 'Average velocity', {
    integer: true,
    allowZero: true
  })
  const sd = optionalNumber(input.sd, 'SD', { allowZero: true })
  const es = optionalNumber(input.es, 'ES', { integer: true, allowZero: true })

  db.prepare(
    `INSERT INTO load_developments (
      id, name, caliber,
      bullet_manufacturer, bullet_model,
      brass_manufacturer, brass_model,
      powder_manufacturer, powder_model,
      primer_manufacturer, primer_model,
      powder_charge, coal, shoulder_bump, neck_tension, lands,
      cbto, velocity, sd, es, notes,
      created_at, updated_at
    ) VALUES (
      @id, @name, @caliber,
      @bulletManufacturer, @bulletModel,
      @brassManufacturer, @brassModel,
      @powderManufacturer, @powderModel,
      @primerManufacturer, @primerModel,
      @powderCharge, @coal, @shoulderBump, @neckTension, @lands,
      @cbto, @velocity, @sd, @es, @notes,
      @createdAt, @updatedAt
    )`
  ).run({
    id,
    name,
    caliber,
    bulletManufacturer: emptyString(input.bulletManufacturer),
    bulletModel: emptyString(input.bulletModel),
    brassManufacturer: emptyString(input.brassManufacturer),
    brassModel: nullIfEmpty(input.brassModel),
    powderManufacturer: emptyString(input.powderManufacturer),
    powderModel: emptyString(input.powderModel),
    primerManufacturer: emptyString(input.primerManufacturer),
    primerModel: emptyString(input.primerModel),
    powderCharge,
    coal: optionalNumber(input.coal, 'COAL', { min: 0 }),
    shoulderBump,
    neckTension,
    lands,
    cbto,
    velocity,
    sd,
    es,
    notes: nullIfEmpty(input.notes),
    createdAt,
    updatedAt
  })

  return getLoad(db, id)!
}

export function updateLoad(
  db: Database.Database,
  id: string,
  patch: UpdateLoadInput
): LoadDevelopment {
  const existing = getLoad(db, id)
  if (!existing) throw new Error(`Load not found: ${id}`)

  const name = patch.name !== undefined ? requireTrimmed(patch.name, 'Load name') : existing.name
  const caliber =
    patch.caliber !== undefined ? requireTrimmed(patch.caliber, 'Cartridge') : existing.caliber
  const dateUpdated =
    patch.dateUpdated !== undefined
      ? requireIsoDate(patch.dateUpdated, 'Date updated')
      : todayIsoDate()
  const updatedAt = timestampFromIsoDate(dateUpdated)

  const powderCharge =
    patch.powderCharge !== undefined
      ? optionalNumber(patch.powderCharge, 'Charge weight', { min: 0.1 })
      : existing.powderCharge
  const shoulderBump =
    patch.shoulderBump !== undefined
      ? optionalNumber(patch.shoulderBump, 'Shoulder bump', { allowZero: true })
      : existing.shoulderBump
  const neckTension =
    patch.neckTension !== undefined
      ? optionalNumber(patch.neckTension, 'Neck tension', { allowZero: true })
      : existing.neckTension
  const lands =
    patch.lands !== undefined
      ? optionalNumber(patch.lands, 'Lands', { min: 0 })
      : existing.lands
  const cbto =
    patch.cbto !== undefined ? optionalNumber(patch.cbto, 'CBTO', { min: 0 }) : existing.cbto
  const velocity =
    patch.velocity !== undefined
      ? optionalNumber(patch.velocity, 'Average velocity', { integer: true, allowZero: true })
      : existing.velocity
  const sd =
    patch.sd !== undefined ? optionalNumber(patch.sd, 'SD', { allowZero: true }) : existing.sd
  const es =
    patch.es !== undefined
      ? optionalNumber(patch.es, 'ES', { integer: true, allowZero: true })
      : existing.es

  db.prepare(
    `UPDATE load_developments SET
      name = @name,
      caliber = @caliber,
      bullet_manufacturer = @bulletManufacturer,
      bullet_model = @bulletModel,
      brass_manufacturer = @brassManufacturer,
      brass_model = @brassModel,
      powder_manufacturer = @powderManufacturer,
      powder_model = @powderModel,
      primer_manufacturer = @primerManufacturer,
      primer_model = @primerModel,
      powder_charge = @powderCharge,
      coal = @coal,
      shoulder_bump = @shoulderBump,
      neck_tension = @neckTension,
      lands = @lands,
      cbto = @cbto,
      velocity = @velocity,
      sd = @sd,
      es = @es,
      notes = @notes,
      updated_at = @updatedAt
    WHERE id = @id`
  ).run({
    id,
    name,
    caliber,
    bulletManufacturer:
      patch.bulletManufacturer !== undefined
        ? emptyString(patch.bulletManufacturer)
        : existing.bulletManufacturer,
    bulletModel:
      patch.bulletModel !== undefined ? emptyString(patch.bulletModel) : existing.bulletModel,
    brassManufacturer:
      patch.brassManufacturer !== undefined
        ? emptyString(patch.brassManufacturer)
        : existing.brassManufacturer,
    brassModel:
      patch.brassModel !== undefined ? nullIfEmpty(patch.brassModel) : existing.brassModel,
    powderManufacturer:
      patch.powderManufacturer !== undefined
        ? emptyString(patch.powderManufacturer)
        : existing.powderManufacturer,
    powderModel:
      patch.powderModel !== undefined ? emptyString(patch.powderModel) : existing.powderModel,
    primerManufacturer:
      patch.primerManufacturer !== undefined
        ? emptyString(patch.primerManufacturer)
        : existing.primerManufacturer,
    primerModel:
      patch.primerModel !== undefined ? emptyString(patch.primerModel) : existing.primerModel,
    powderCharge,
    coal:
      patch.coal !== undefined
        ? optionalNumber(patch.coal, 'COAL', { min: 0 })
        : existing.coal,
    shoulderBump,
    neckTension,
    lands,
    cbto,
    velocity,
    sd,
    es,
    notes: patch.notes !== undefined ? nullIfEmpty(patch.notes) : existing.notes,
    updatedAt
  })

  return getLoad(db, id)!
}

export function deleteLoad(db: Database.Database, id: string): void {
  const existing = getLoad(db, id)
  if (!existing) throw new Error(`Load not found: ${id}`)
  db.prepare(`DELETE FROM load_developments WHERE id = ?`).run(id)
}
