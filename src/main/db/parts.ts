/**
 * Parts inventory CRUD + maintenance reset (software-spec §6.2).
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
import type { MuzzleType, Part, PartStatus, PartType } from './types'

type PartRow = {
  id: string
  name: string
  manufacturer: string
  value: number
  type: PartType
  status: PartStatus
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
  created_at: string
  updated_at: string
}

export type NewPartInput = {
  id?: string
  name: string
  manufacturer: string
  value?: number
  type: PartType
  status?: PartStatus
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
}

export type UpdatePartInput = Partial<Omit<NewPartInput, 'id' | 'type'>>

export type ListPartsOptions = {
  types?: PartType[]
  statuses?: PartStatus[]
  search?: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapPart(row: PartRow): Part {
  return {
    id: row.id,
    name: row.name,
    manufacturer: row.manufacturer,
    value: row.value,
    type: row.type,
    status: row.status,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function validatePartFields(
  type: PartType,
  input: {
    name?: string
    manufacturer?: string
    serialNumber?: string | null
    caliber?: string | null
    gunsmith?: string | null
    muzzleType?: MuzzleType | null
    status?: PartStatus
  },
  requireCore: boolean
): void {
  if (requireCore || input.name !== undefined) {
    if (!input.name?.trim()) throw new Error('Part name is required')
  }
  if (requireCore || input.manufacturer !== undefined) {
    if (!input.manufacturer?.trim()) throw new Error('Manufacturer is required')
  }
  if (type === 'Action' || type === 'Optic') {
    if (requireCore || input.serialNumber !== undefined) {
      if (!String(input.serialNumber ?? '').trim()) {
        throw new Error(`Serial number is required for ${type}`)
      }
    }
  }
  if (type === 'Barrel') {
    if (requireCore || input.caliber !== undefined) {
      if (!String(input.caliber ?? '').trim()) throw new Error('Cartridge is required for Barrel')
    }
    if (requireCore || input.gunsmith !== undefined) {
      if (!String(input.gunsmith ?? '').trim()) throw new Error('Gunsmith is required for Barrel')
    }
  }
  if (input.muzzleType != null) {
    if (input.muzzleType !== 'Suppressor' && input.muzzleType !== 'Brake') {
      throw new Error('Muzzle type must be Suppressor or Brake')
    }
  }
  if (input.status === 'Retired' && type !== 'Barrel') {
    throw new Error('Only barrels may be Retired')
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
      `(LOWER(name) LIKE ? OR LOWER(manufacturer) LIKE ? OR LOWER(COALESCE(model, '')) LIKE ? OR LOWER(COALESCE(caliber, '')) LIKE ? OR LOWER(COALESCE(serial_number, '')) LIKE ?)`
    )
    params.push(q, q, q, q, q)
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db
    .prepare(
      `SELECT * FROM parts ${where}
       ORDER BY type ASC, manufacturer ASC, name ASC`
    )
    .all(...params) as PartRow[]
  return rows.map(mapPart)
}

export function createPart(db: Database.Database, input: NewPartInput): Part {
  validatePartFields(input.type, input, true)

  const id = input.id ?? randomUUID()
  const createdAt = nowIso()
  const status = input.status ?? 'In Stock'
  const maintenanceDefault =
    input.type === 'Action' || input.type === 'Barrel' || input.type === 'Suppressor'
      ? (input.maintenanceInterval ?? 1000)
      : null

  db.prepare(
    `INSERT INTO parts (
      id, name, manufacturer, value, type, status, model, serial_number,
      total_round_count, rounds_after_cleaning, maintenance_interval,
      caliber, gunsmith, twist_rate, barrel_life, muzzle_type, notes,
      created_at, updated_at
    ) VALUES (
      @id, @name, @manufacturer, @value, @type, @status, @model, @serialNumber,
      @totalRoundCount, @roundsAfterCleaning, @maintenanceInterval,
      @caliber, @gunsmith, @twistRate, @barrelLife, @muzzleType, @notes,
      @createdAt, @updatedAt
    )`
  ).run({
    id,
    name: input.name.trim(),
    manufacturer: input.manufacturer.trim(),
    value: input.value ?? 0,
    type: input.type,
    status,
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
  if (nextStatus === 'Retired' && existing.type !== 'Barrel') {
    throw new Error('Only barrels may be Retired')
  }

  const updatedAt = nowIso()
  db.prepare(
    `UPDATE parts SET
      name = @name,
      manufacturer = @manufacturer,
      value = @value,
      status = @status,
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
      updated_at = @updatedAt
    WHERE id = @id`
  ).run({
    id,
    name: (patch.name ?? existing.name).trim(),
    manufacturer: (patch.manufacturer ?? existing.manufacturer).trim(),
    value: patch.value ?? existing.value,
    status: nextStatus,
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
    updatedAt
  })

  return getPart(db, id)!
}

export function setPartStatus(db: Database.Database, id: string, status: PartStatus): Part {
  const existing = getPart(db, id)
  if (!existing) throw new Error(`Part not found: ${id}`)
  if (status === 'Retired' && existing.type !== 'Barrel') {
    throw new Error('Only barrels may be Retired')
  }
  return updatePart(db, id, { status })
}

/** Reset roundsAfterCleaning to 0 for Action / Barrel / Muzzle. */
export function resetPartMaintenance(db: Database.Database, id: string): Part {
  const existing = getPart(db, id)
  if (!existing) throw new Error(`Part not found: ${id}`)
  if (existing.type !== 'Action' && existing.type !== 'Barrel' && existing.type !== 'Suppressor') {
    throw new Error('Maintenance reset applies only to Action, Barrel, and Muzzle Device')
  }
  return updatePart(db, id, { roundsAfterCleaning: 0 })
}

function partIsReferenced(db: Database.Database, id: string): boolean {
  const systemRef = db
    .prepare(
      `SELECT id FROM systems
       WHERE action_id = ? OR barrel_id = ? OR chassis_id = ? OR optic_id = ? OR suppressor_id = ?
       LIMIT 1`
    )
    .get(id, id, id, id, id) as { id: string } | undefined
  if (systemRef) return true

  const miscRef = db
    .prepare(`SELECT system_id FROM system_misc_parts WHERE part_id = ? LIMIT 1`)
    .get(id) as { system_id: string } | undefined
  if (miscRef) return true

  const logRef = db.prepare(`SELECT id FROM shooting_logs WHERE barrel_id = ? LIMIT 1`).get(id) as
    { id: string } | undefined
  return Boolean(logRef)
}

export function deletePart(db: Database.Database, id: string): void {
  const existing = getPart(db, id)
  if (!existing) throw new Error(`Part not found: ${id}`)
  if (existing.status === 'In Use' || partIsReferenced(db, id)) {
    throw new Error('Cannot delete a part that is In Use or referenced by a build or log')
  }
  db.prepare(`DELETE FROM parts WHERE id = ?`).run(id)
}
