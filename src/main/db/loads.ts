/**
 * Load development (reloading recipe) CRUD — software-spec §3.5 / §6.5.
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
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
  powder_charge: number
  coal: number
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
  bulletManufacturer: string
  bulletModel: string
  brassManufacturer: string
  brassModel?: string | null
  powderManufacturer: string
  powderModel: string
  primerManufacturer: string
  primerModel: string
  powderCharge: number
  coal: number
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

function nullIfEmpty(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
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

function requirePositiveNumber(value: number | undefined, label: string): number {
  if (value == null || !Number.isFinite(value)) {
    throw new Error(`${label} is required`)
  }
  if (value <= 0) throw new Error(`${label} must be greater than 0`)
  return value
}

export function listLoads(db: Database.Database): LoadDevelopment[] {
  const rows = db
    .prepare(`SELECT * FROM load_developments ORDER BY caliber ASC, name ASC`)
    .all() as LoadRow[]
  return rows.map(mapLoad)
}

export function getLoad(db: Database.Database, id: string): LoadDevelopment | null {
  const row = db.prepare(`SELECT * FROM load_developments WHERE id = ?`).get(id) as
    LoadRow | undefined
  return row ? mapLoad(row) : null
}

export function createLoad(db: Database.Database, input: NewLoadInput): LoadDevelopment {
  const name = requireTrimmed(input.name, 'Load name')
  const caliber = requireTrimmed(input.caliber, 'Cartridge')
  const bulletManufacturer = requireTrimmed(input.bulletManufacturer, 'Bullet manufacturer')
  const bulletModel = requireTrimmed(input.bulletModel, 'Bullet model')
  const brassManufacturer = requireTrimmed(input.brassManufacturer, 'Brass manufacturer')
  const powderManufacturer = requireTrimmed(input.powderManufacturer, 'Powder manufacturer')
  const powderModel = requireTrimmed(input.powderModel, 'Powder model')
  const primerManufacturer = requireTrimmed(input.primerManufacturer, 'Primer manufacturer')
  const primerModel = requireTrimmed(input.primerModel, 'Primer model')
  const powderCharge = requirePositiveNumber(input.powderCharge, 'Powder charge')
  const coal = requirePositiveNumber(input.coal, 'COAL')

  const id = input.id ?? randomUUID()
  const createdAt = nowIso()

  db.prepare(
    `INSERT INTO load_developments (
      id, name, caliber,
      bullet_manufacturer, bullet_model,
      brass_manufacturer, brass_model,
      powder_manufacturer, powder_model,
      primer_manufacturer, primer_model,
      powder_charge, coal, cbto, velocity, sd, es, notes,
      created_at, updated_at
    ) VALUES (
      @id, @name, @caliber,
      @bulletManufacturer, @bulletModel,
      @brassManufacturer, @brassModel,
      @powderManufacturer, @powderModel,
      @primerManufacturer, @primerModel,
      @powderCharge, @coal, @cbto, @velocity, @sd, @es, @notes,
      @createdAt, @createdAt
    )`
  ).run({
    id,
    name,
    caliber,
    bulletManufacturer,
    bulletModel,
    brassManufacturer,
    brassModel: nullIfEmpty(input.brassModel),
    powderManufacturer,
    powderModel,
    primerManufacturer,
    primerModel,
    powderCharge,
    coal,
    cbto: input.cbto ?? null,
    velocity: input.velocity ?? null,
    sd: input.sd ?? null,
    es: input.es ?? null,
    notes: nullIfEmpty(input.notes),
    createdAt
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
  const bulletManufacturer =
    patch.bulletManufacturer !== undefined
      ? requireTrimmed(patch.bulletManufacturer, 'Bullet manufacturer')
      : existing.bulletManufacturer
  const bulletModel =
    patch.bulletModel !== undefined
      ? requireTrimmed(patch.bulletModel, 'Bullet model')
      : existing.bulletModel
  const brassManufacturer =
    patch.brassManufacturer !== undefined
      ? requireTrimmed(patch.brassManufacturer, 'Brass manufacturer')
      : existing.brassManufacturer
  const powderManufacturer =
    patch.powderManufacturer !== undefined
      ? requireTrimmed(patch.powderManufacturer, 'Powder manufacturer')
      : existing.powderManufacturer
  const powderModel =
    patch.powderModel !== undefined
      ? requireTrimmed(patch.powderModel, 'Powder model')
      : existing.powderModel
  const primerManufacturer =
    patch.primerManufacturer !== undefined
      ? requireTrimmed(patch.primerManufacturer, 'Primer manufacturer')
      : existing.primerManufacturer
  const primerModel =
    patch.primerModel !== undefined
      ? requireTrimmed(patch.primerModel, 'Primer model')
      : existing.primerModel
  const powderCharge =
    patch.powderCharge !== undefined
      ? requirePositiveNumber(patch.powderCharge, 'Powder charge')
      : existing.powderCharge
  const coal = patch.coal !== undefined ? requirePositiveNumber(patch.coal, 'COAL') : existing.coal

  const updatedAt = nowIso()
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
    bulletManufacturer,
    bulletModel,
    brassManufacturer,
    brassModel:
      patch.brassModel !== undefined ? nullIfEmpty(patch.brassModel) : existing.brassModel,
    powderManufacturer,
    powderModel,
    primerManufacturer,
    primerModel,
    powderCharge,
    coal,
    cbto: patch.cbto !== undefined ? patch.cbto : existing.cbto,
    velocity: patch.velocity !== undefined ? patch.velocity : existing.velocity,
    sd: patch.sd !== undefined ? patch.sd : existing.sd,
    es: patch.es !== undefined ? patch.es : existing.es,
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
