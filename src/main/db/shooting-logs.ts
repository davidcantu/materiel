/**
 * Shooting log CRUD with atomic side effects (software-spec §7.2).
 *
 * Add / update / delete adjusts part round counts and ammo quantity
 * inside a single SQLite transaction.
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
import { adjustSystemTotalRounds } from './systems'
import type { NewShootingLogInput, SessionType, ShootingLog, UpdateShootingLogInput } from './types'

type SystemRow = {
  id: string
  action_id: string
  barrel_id: string
  suppressor_id: string | null
}

type PartRow = {
  id: string
  type: string
  total_round_count: number
  rounds_after_cleaning: number
}

type LogRow = {
  id: string
  system_id: string | null
  barrel_id: string | null
  ammo_id: string | null
  cartridge: string | null
  date: string
  location: string
  rounds_fired: number
  velocity: number | null
  session_type: SessionType
  placement: number | null
  percent_of_winner: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** Parts that receive round-count deltas when a session is logged. */
const ROUND_TRACKED_TYPES = new Set(['Action', 'Barrel', 'Suppressor', 'BCG', 'Pistol', 'Lower'])

function nowIso(): string {
  return new Date().toISOString()
}

function normalizePlacement(value: number | null | undefined): number | null {
  if (value == null) return null
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error('Placement must be a whole number ≥ 1')
  }
  return value
}

function normalizePercentOfWinner(value: number | null | undefined): number | null {
  if (value == null) return null
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('% of Winner must be between 0 and 100')
  }
  // Persist at 3-decimal precision.
  return Math.round(value * 1000) / 1000
}

function mapLog(row: LogRow): ShootingLog {
  return {
    id: row.id,
    systemId: row.system_id,
    barrelId: row.barrel_id,
    ammoId: row.ammo_id,
    cartridge: row.cartridge,
    date: row.date,
    location: row.location,
    roundsFired: row.rounds_fired,
    velocity: row.velocity,
    sessionType: row.session_type,
    placement: row.placement ?? null,
    percentOfWinner: row.percent_of_winner ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function getSystem(db: Database.Database, systemId: string): SystemRow {
  const row = db
    .prepare(`SELECT id, action_id, barrel_id, suppressor_id FROM systems WHERE id = ?`)
    .get(systemId) as SystemRow | undefined
  if (!row) {
    throw new Error(`System not found: ${systemId}`)
  }
  return row
}

function getMiscPartIds(db: Database.Database, systemId: string): string[] {
  const rows = db
    .prepare(`SELECT part_id FROM system_misc_parts WHERE system_id = ? ORDER BY position ASC`)
    .all(systemId) as Array<{ part_id: string }>
  return rows.map((r) => r.part_id)
}

/** Spec §7.2: action, barrel, suppressor, and misc part ids on the system. */
function trackedPartIds(db: Database.Database, system: SystemRow): string[] {
  const ids = [system.action_id, system.barrel_id]
  if (system.suppressor_id) ids.push(system.suppressor_id)
  ids.push(...getMiscPartIds(db, system.id))
  return [...new Set(ids)]
}

function applyRoundDelta(db: Database.Database, partIds: string[], delta: number): void {
  if (delta === 0 || partIds.length === 0) return

  const select = db.prepare(
    `SELECT id, type, total_round_count, rounds_after_cleaning FROM parts WHERE id = ?`
  )
  const update = db.prepare(
    `UPDATE parts
     SET total_round_count = @total,
         rounds_after_cleaning = @after,
         updated_at = @updatedAt
     WHERE id = @id`
  )

  for (const id of partIds) {
    const part = select.get(id) as PartRow | undefined
    if (!part || !ROUND_TRACKED_TYPES.has(part.type)) continue

    const total = Math.max(0, part.total_round_count + delta)
    const after = Math.max(0, part.rounds_after_cleaning + delta)
    update.run({ id, total, after, updatedAt: nowIso() })
  }
}

function applyAmmoDelta(
  db: Database.Database,
  ammoId: string | null | undefined,
  delta: number
): void {
  if (!ammoId || ammoId === 'manual' || delta === 0) return

  const ammo = db.prepare(`SELECT id, quantity FROM ammo_inventory WHERE id = ?`).get(ammoId) as
    | { id: string; quantity: number }
    | undefined

  if (!ammo) {
    // On delete/update reverse: ammo may already be gone — ignore restore if missing.
    if (delta > 0) return
    throw new Error(`Ammo inventory not found: ${ammoId}`)
  }

  const next = ammo.quantity + delta
  if (next <= 0) {
    db.prepare(`DELETE FROM ammo_inventory WHERE id = ?`).run(ammoId)
  } else {
    db.prepare(`UPDATE ammo_inventory SET quantity = ?, updated_at = ? WHERE id = ?`).run(
      next,
      nowIso(),
      ammoId
    )
  }
}

function applyLogSideEffects(
  db: Database.Database,
  systemId: string,
  roundsFired: number,
  ammoId: string | null | undefined,
  direction: 1 | -1
): void {
  const system = getSystem(db, systemId)
  const parts = trackedPartIds(db, system)
  applyRoundDelta(db, parts, direction * roundsFired)
  applyAmmoDelta(db, ammoId, direction * -1 * roundsFired)
  adjustSystemTotalRounds(db, systemId, direction * roundsFired)
}

/** When the build is gone, only the barrel (and ammo) can be adjusted. */
function applyLogSideEffectsForLog(
  db: Database.Database,
  systemId: string | null,
  barrelId: string | null,
  roundsFired: number,
  ammoId: string | null | undefined,
  direction: 1 | -1
): void {
  if (systemId) {
    applyLogSideEffects(db, systemId, roundsFired, ammoId, direction)
    return
  }
  if (barrelId) {
    applyRoundDelta(db, [barrelId], direction * roundsFired)
  }
  applyAmmoDelta(db, ammoId, direction * -1 * roundsFired)
}

function resolveMatchFields(
  sessionType: SessionType,
  placement: number | null | undefined,
  percentOfWinner: number | null | undefined
): { placement: number | null; percentOfWinner: number | null } {
  if (sessionType !== 'Match') {
    return { placement: null, percentOfWinner: null }
  }
  return {
    placement: normalizePlacement(placement),
    percentOfWinner: normalizePercentOfWinner(percentOfWinner)
  }
}

export function getShootingLog(db: Database.Database, id: string): ShootingLog | null {
  const row = db.prepare(`SELECT * FROM shooting_logs WHERE id = ?`).get(id) as LogRow | undefined
  return row ? mapLog(row) : null
}

export function listShootingLogs(db: Database.Database): ShootingLog[] {
  const rows = db
    .prepare(`SELECT * FROM shooting_logs ORDER BY date DESC, created_at DESC`)
    .all() as LogRow[]
  return rows.map(mapLog)
}

export function addShootingLog(db: Database.Database, input: NewShootingLogInput): ShootingLog {
  if (input.roundsFired < 0) {
    throw new Error('roundsFired must be >= 0')
  }

  const run = db.transaction(() => {
    const system = getSystem(db, input.systemId)
    const id = input.id ?? randomUUID()
    const createdAt = nowIso()
    const sessionType: SessionType = input.sessionType ?? 'Practice'
    const ammoId = input.ammoId && input.ammoId !== 'manual' ? input.ammoId : null
    const match = resolveMatchFields(sessionType, input.placement, input.percentOfWinner)

    db.prepare(
      `INSERT INTO shooting_logs (
        id, system_id, barrel_id, ammo_id, cartridge, date, location,
        rounds_fired, velocity, session_type, placement, percent_of_winner,
        notes, created_at, updated_at
      ) VALUES (
        @id, @systemId, @barrelId, @ammoId, @cartridge, @date, @location,
        @roundsFired, @velocity, @sessionType, @placement, @percentOfWinner,
        @notes, @createdAt, @updatedAt
      )`
    ).run({
      id,
      systemId: input.systemId,
      barrelId: system.barrel_id,
      ammoId,
      cartridge: input.cartridge ?? null,
      date: input.date,
      location: input.location,
      roundsFired: input.roundsFired,
      velocity: input.velocity ?? null,
      sessionType,
      placement: match.placement,
      percentOfWinner: match.percentOfWinner,
      notes: input.notes ?? null,
      createdAt,
      updatedAt: createdAt
    })

    applyLogSideEffects(db, input.systemId, input.roundsFired, ammoId, 1)

    return getShootingLog(db, id)!
  })

  return run()
}

export function deleteShootingLog(db: Database.Database, id: string): void {
  const run = db.transaction(() => {
    const existing = getShootingLog(db, id)
    if (!existing) {
      throw new Error(`Shooting log not found: ${id}`)
    }

    applyLogSideEffectsForLog(
      db,
      existing.systemId,
      existing.barrelId,
      existing.roundsFired,
      existing.ammoId,
      -1
    )
    db.prepare(`DELETE FROM shooting_logs WHERE id = ?`).run(id)
  })

  run()
}

export function updateShootingLog(
  db: Database.Database,
  input: UpdateShootingLogInput
): ShootingLog {
  const run = db.transaction(() => {
    const existing = getShootingLog(db, input.id)
    if (!existing) {
      throw new Error(`Shooting log not found: ${input.id}`)
    }

    // Reverse old side effects, then apply new (§7.2 update).
    applyLogSideEffectsForLog(
      db,
      existing.systemId,
      existing.barrelId,
      existing.roundsFired,
      existing.ammoId,
      -1
    )

    const systemId = input.systemId !== undefined ? input.systemId : existing.systemId
    if (!systemId) {
      throw new Error('Assign this session to a build before editing rounds or details')
    }
    const system = getSystem(db, systemId)
    const roundsFired = input.roundsFired ?? existing.roundsFired
    if (roundsFired < 0) {
      throw new Error('roundsFired must be >= 0')
    }

    const ammoIdRaw = input.ammoId !== undefined ? input.ammoId : existing.ammoId
    const ammoId = ammoIdRaw && ammoIdRaw !== 'manual' ? ammoIdRaw : null
    const sessionType = input.sessionType ?? existing.sessionType
    const match = resolveMatchFields(
      sessionType,
      input.placement !== undefined ? input.placement : existing.placement,
      input.percentOfWinner !== undefined ? input.percentOfWinner : existing.percentOfWinner
    )
    const updatedAt = nowIso()

    db.prepare(
      `UPDATE shooting_logs SET
        system_id = @systemId,
        barrel_id = @barrelId,
        ammo_id = @ammoId,
        cartridge = @cartridge,
        date = @date,
        location = @location,
        rounds_fired = @roundsFired,
        velocity = @velocity,
        session_type = @sessionType,
        placement = @placement,
        percent_of_winner = @percentOfWinner,
        notes = @notes,
        updated_at = @updatedAt
      WHERE id = @id`
    ).run({
      id: input.id,
      systemId,
      barrelId: system.barrel_id,
      ammoId,
      cartridge: input.cartridge !== undefined ? input.cartridge : existing.cartridge,
      date: input.date ?? existing.date,
      location: input.location ?? existing.location,
      roundsFired,
      velocity: input.velocity !== undefined ? input.velocity : existing.velocity,
      sessionType,
      placement: match.placement,
      percentOfWinner: match.percentOfWinner,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      updatedAt
    })

    applyLogSideEffects(db, systemId, roundsFired, ammoId, 1)
    return getShootingLog(db, input.id)!
  })

  return run()
}
