/**
 * Parts inventory CRUD + maintenance reset (software-spec §6.2).
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
import {
  parsePlatformsJson,
  serializePlatforms,
  type Platform
} from '../../shared/platforms'
import { normalizePartPlatforms } from '../../shared/platforms'
import { isWearStatusTracked, requiresSerialNumber } from '../../shared/parts'
import type { MuzzleType, Part, PartStatus, PartType } from './types'

type PartRow = {
  id: string
  manufacturer: string
  value: number
  type: PartType
  status: PartStatus
  platforms: string
  name: string | null
  model: string | null
  serial_number: string | null
  total_round_count: number
  rounds_after_cleaning: number
  maintenance_interval: number | null
  caliber: string | null
  gunsmith: string | null
  twist_rate: number | null
  barrel_life: number | null
  muzzle_type: MuzzleType | null
  notes: string | null
  sold_to_note: string | null
  created_at: string
  updated_at: string
}

export type NewPartInput = {
  id?: string
  manufacturer: string
  value?: number
  type: PartType
  status?: PartStatus
  platforms?: Platform[]
  name?: string | null
  model?: string | null
  serialNumber?: string | null
  totalRoundCount?: number
  roundsAfterCleaning?: number
  maintenanceInterval?: number | null
  caliber?: string | null
  gunsmith?: string | null
  twistRate?: number | null
  barrelLife?: number | null
  muzzleType?: MuzzleType | null
  notes?: string | null
  soldToNote?: string | null
}

export type UpdatePartInput = Partial<Omit<NewPartInput, 'id' | 'type'>>

export type SetPartStatusOptions = {
  soldToNote?: string | null
}

export type ListPartsOptions = {
  types?: PartType[]
  statuses?: PartStatus[]
  platforms?: Platform[]
  search?: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapPart(row: PartRow): Part {
  return {
    id: row.id,
    manufacturer: row.manufacturer,
    value: row.value,
    type: row.type,
    status: row.status,
    platforms: parsePlatformsJson(row.platforms),
    name: row.name ?? null,
    model: row.model,
    serialNumber: row.serial_number,
    totalRoundCount: row.total_round_count,
    roundsAfterCleaning: row.rounds_after_cleaning,
    maintenanceInterval: row.maintenance_interval,
    caliber: row.caliber,
    gunsmith: row.gunsmith,
    twistRate: row.twist_rate,
    barrelLife: row.barrel_life,
    muzzleType: row.muzzle_type,
    notes: row.notes,
    soldToNote: row.sold_to_note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function validatePartFields(
  type: PartType,
  input: {
    manufacturer?: string
    name?: string | null
    serialNumber?: string | null
    caliber?: string | null
    gunsmith?: string | null
    muzzleType?: MuzzleType | null
    status?: PartStatus
    platforms?: Platform[] | null
  },
  requireCore: boolean
): void {
  if (requireCore || input.manufacturer !== undefined) {
    if (!input.manufacturer?.trim()) throw new Error('Manufacturer is required')
  }
  const muzzleForSerial =
    type === 'Suppressor' ? (input.muzzleType ?? 'Suppressor') : input.muzzleType
  if (requiresSerialNumber(type, muzzleForSerial)) {
    if (requireCore || input.serialNumber !== undefined) {
      if (!String(input.serialNumber ?? '').trim()) {
        const label = type === 'Suppressor' ? 'Suppressor' : type
        throw new Error(`Serial number is required for ${label}`)
      }
    }
  }
  if (type === 'Barrel') {
    if (requireCore || input.name !== undefined) {
      if (!String(input.name ?? '').trim()) throw new Error('Name is required for Barrel')
    }
    if (requireCore || input.caliber !== undefined) {
      if (!String(input.caliber ?? '').trim()) throw new Error('Cartridge is required for Barrel')
    }
    if (requireCore || input.gunsmith !== undefined) {
      if (!String(input.gunsmith ?? '').trim()) throw new Error('Gunsmith is required for Barrel')
    }
  }
  if (type === 'Pistol' || type === 'Frame') {
    if (requireCore || input.caliber !== undefined) {
      if (!String(input.caliber ?? '').trim()) {
        throw new Error('Cartridge is required for Frame')
      }
    }
  }
  if (input.muzzleType != null) {
    if (input.muzzleType !== 'Suppressor' && input.muzzleType !== 'Brake') {
      throw new Error('Muzzle type must be Suppressor or Brake')
    }
  }
  if (input.status === 'Retired' && !isWearStatusTracked(type)) {
    throw new Error('Only wear parts (Barrel, Trigger) may be Retired')
  }
  if (input.platforms !== undefined && input.platforms !== null) {
    const normalized = normalizePartPlatforms(type, input.platforms)
    if (normalized.length === 0) {
      throw new Error(`No valid platforms for part type ${type}`)
    }
  }
}

export function getPart(db: Database.Database, id: string): Part | null {
  const row = db.prepare(`SELECT * FROM parts WHERE id = ?`).get(id) as PartRow | undefined
  return row ? mapPart(row) : null
}

export function listParts(db: Database.Database, options: ListPartsOptions = {}): Part[] {
  const clauses: string[] = []
  const params: unknown[] = []

  if (options.types && options.types.length > 0) {
    clauses.push(`type IN (${options.types.map(() => '?').join(', ')})`)
    params.push(...options.types)
  }
  if (options.statuses && options.statuses.length > 0) {
    clauses.push(`status IN (${options.statuses.map(() => '?').join(', ')})`)
    params.push(...options.statuses)
  }
  if (options.search?.trim()) {
    const q = `%${options.search.trim().toLowerCase()}%`
    clauses.push(
      `(LOWER(manufacturer) LIKE ? OR LOWER(COALESCE(name, '')) LIKE ? OR LOWER(COALESCE(model, '')) LIKE ? OR LOWER(COALESCE(caliber, '')) LIKE ? OR LOWER(COALESCE(serial_number, '')) LIKE ?)`
    )
    params.push(q, q, q, q, q)
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db
    .prepare(
      `SELECT * FROM parts ${where}
       ORDER BY type ASC, manufacturer ASC, COALESCE(name, model, caliber, '') ASC`
    )
    .all(...params) as PartRow[]

  let parts = rows.map(mapPart)
  if (options.platforms && options.platforms.length > 0) {
    const wanted = new Set(options.platforms)
    parts = parts.filter((part) => part.platforms.some((p) => wanted.has(p)))
  }
  return parts
}

export function createPart(db: Database.Database, input: NewPartInput): Part {
  validatePartFields(input.type, input, true)

  const id = input.id ?? randomUUID()
  const createdAt = nowIso()
  const status = input.status ?? 'In Stock'
  const platforms = normalizePartPlatforms(input.type, input.platforms)
  const maintenanceDefault =
    input.type === 'Action' ||
    input.type === 'Barrel' ||
    input.type === 'Suppressor' ||
    input.type === 'BCG' ||
    input.type === 'Pistol'
      ? (input.maintenanceInterval ?? 1000)
      : null

  db.prepare(
    `INSERT INTO parts (
      id, manufacturer, value, type, status, platforms, name, model, serial_number,
      total_round_count, rounds_after_cleaning, maintenance_interval,
      caliber, gunsmith, twist_rate, barrel_life, muzzle_type, notes, sold_to_note,
      created_at, updated_at
    ) VALUES (
      @id, @manufacturer, @value, @type, @status, @platforms, @name, @model, @serialNumber,
      @totalRoundCount, @roundsAfterCleaning, @maintenanceInterval,
      @caliber, @gunsmith, @twistRate, @barrelLife, @muzzleType, @notes, @soldToNote,
      @createdAt, @updatedAt
    )`
  ).run({
    id,
    manufacturer: input.manufacturer.trim(),
    value: input.value ?? 0,
    type: input.type,
    status,
    platforms: serializePlatforms(platforms),
    name: input.type === 'Barrel' ? input.name?.trim() || null : null,
    model: input.model?.trim() || null,
    serialNumber: input.serialNumber?.trim() || null,
    totalRoundCount: input.totalRoundCount ?? 0,
    roundsAfterCleaning: input.roundsAfterCleaning ?? 0,
    maintenanceInterval: maintenanceDefault,
    caliber: input.caliber?.trim() || null,
    gunsmith: input.gunsmith?.trim() || null,
    twistRate: input.twistRate ?? (input.type === 'Barrel' ? 8 : null),
    barrelLife: input.barrelLife ?? (input.type === 'Barrel' ? 2500 : null),
    muzzleType:
      input.type === 'Suppressor' ? (input.muzzleType ?? 'Suppressor') : (input.muzzleType ?? null),
    notes: input.notes?.trim() || null,
    soldToNote: input.soldToNote?.trim() || null,
    createdAt,
    updatedAt: createdAt
  })

  return getPart(db, id)!
}

export function updatePart(db: Database.Database, id: string, patch: UpdatePartInput): Part {
  const existing = getPart(db, id)
  if (!existing) throw new Error(`Part not found: ${id}`)

  validatePartFields(existing.type, patch, false)

  const nextStatus = patch.status ?? existing.status
  if (nextStatus === 'Retired' && !isWearStatusTracked(existing.type)) {
    throw new Error('Only wear parts (Barrel, Trigger) may be Retired')
  }

  const platforms =
    patch.platforms !== undefined
      ? normalizePartPlatforms(existing.type, patch.platforms)
      : existing.platforms

  const updatedAt = nowIso()
  const nextName =
    existing.type === 'Barrel'
      ? patch.name !== undefined
        ? patch.name?.trim() || null
        : existing.name
      : null

  db.prepare(
    `UPDATE parts SET
      manufacturer = @manufacturer,
      value = @value,
      status = @status,
      platforms = @platforms,
      name = @name,
      model = @model,
      serial_number = @serialNumber,
      total_round_count = @totalRoundCount,
      rounds_after_cleaning = @roundsAfterCleaning,
      maintenance_interval = @maintenanceInterval,
      caliber = @caliber,
      gunsmith = @gunsmith,
      twist_rate = @twistRate,
      barrel_life = @barrelLife,
      muzzle_type = @muzzleType,
      notes = @notes,
      sold_to_note = @soldToNote,
      updated_at = @updatedAt
    WHERE id = @id`
  ).run({
    id,
    manufacturer: (patch.manufacturer ?? existing.manufacturer).trim(),
    value: patch.value ?? existing.value,
    status: nextStatus,
    platforms: serializePlatforms(platforms),
    name: nextName,
    model: patch.model !== undefined ? patch.model?.trim() || null : existing.model,
    serialNumber:
      patch.serialNumber !== undefined ? patch.serialNumber?.trim() || null : existing.serialNumber,
    totalRoundCount: patch.totalRoundCount ?? existing.totalRoundCount,
    roundsAfterCleaning: patch.roundsAfterCleaning ?? existing.roundsAfterCleaning,
    maintenanceInterval:
      patch.maintenanceInterval !== undefined
        ? patch.maintenanceInterval
        : existing.maintenanceInterval,
    caliber: patch.caliber !== undefined ? patch.caliber?.trim() || null : existing.caliber,
    gunsmith: patch.gunsmith !== undefined ? patch.gunsmith?.trim() || null : existing.gunsmith,
    twistRate: patch.twistRate !== undefined ? patch.twistRate : existing.twistRate,
    barrelLife: patch.barrelLife !== undefined ? patch.barrelLife : existing.barrelLife,
    muzzleType: patch.muzzleType !== undefined ? patch.muzzleType : existing.muzzleType,
    notes: patch.notes !== undefined ? patch.notes?.trim() || null : existing.notes,
    soldToNote:
      patch.soldToNote !== undefined ? patch.soldToNote?.trim() || null : existing.soldToNote,
    updatedAt
  })

  return getPart(db, id)!
}

/**
 * Status rules:
 * - Sold is available for all parts (with optional sold-to note).
 * - Return to stock from Sold is available for all parts.
 * - In Use / Retired / other wear transitions stay Barrel + Trigger only.
 */
export function setPartStatus(
  db: Database.Database,
  id: string,
  status: PartStatus,
  options?: SetPartStatusOptions
): Part {
  const existing = getPart(db, id)
  if (!existing) throw new Error(`Part not found: ${id}`)

  if (status === 'Sold') {
    return updatePart(db, id, {
      status: 'Sold',
      soldToNote: options?.soldToNote !== undefined ? options.soldToNote : existing.soldToNote
    })
  }

  if (status === 'In Stock' && existing.status === 'Sold') {
    return updatePart(db, id, { status: 'In Stock' })
  }

  if (!isWearStatusTracked(existing.type)) {
    throw new Error('Only wear parts (Barrel, Trigger) support this status change')
  }

  if (status === 'Retired' && !isWearStatusTracked(existing.type)) {
    throw new Error('Only wear parts (Barrel, Trigger) may be Retired')
  }

  return updatePart(db, id, { status })
}

/** Reset roundsAfterCleaning to 0 for Action / Barrel / Muzzle / BCG / Pistol. */
export function resetPartMaintenance(db: Database.Database, id: string): Part {
  const existing = getPart(db, id)
  if (!existing) throw new Error(`Part not found: ${id}`)
  if (
    existing.type !== 'Action' &&
    existing.type !== 'Barrel' &&
    existing.type !== 'Suppressor' &&
    existing.type !== 'BCG' &&
    existing.type !== 'Pistol'
  ) {
    throw new Error(
      'Maintenance reset applies only to Action, Barrel, Muzzle Device, BCG, and Pistol'
    )
  }
  return updatePart(db, id, { roundsAfterCleaning: 0 })
}

/** True when the part is attached to a build (core slot or misc). Logs do not count. */
function partIsOnSystem(db: Database.Database, id: string): boolean {
  const systemRef = db
    .prepare(
      `SELECT id FROM systems
       WHERE action_id = ? OR barrel_id = ? OR chassis_id = ? OR optic_id = ?
          OR suppressor_id = ? OR laser_ir_id = ? OR light_id = ?
       LIMIT 1`
    )
    .get(id, id, id, id, id, id, id) as { id: string } | undefined
  if (systemRef) return true

  const miscRef = db
    .prepare(`SELECT system_id FROM system_misc_parts WHERE part_id = ? LIMIT 1`)
    .get(id) as { system_id: string } | undefined
  return Boolean(miscRef)
}

/**
 * Delete an unused part. In Use / build-attached parts are blocked.
 * Shooting logs keep history via barrel_id ON DELETE SET NULL.
 */
export function deletePart(db: Database.Database, id: string): void {
  const existing = getPart(db, id)
  if (!existing) throw new Error(`Part not found: ${id}`)
  if (existing.status === 'In Use' || partIsOnSystem(db, id)) {
    throw new Error('Cannot delete a part that is In Use or attached to a build')
  }
  db.prepare(`DELETE FROM parts WHERE id = ?`).run(id)
}
