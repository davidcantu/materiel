/**
 * After-Action Review CRUD, PPEWS upsert, complete validation, rifle prefill.
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
import {
  AAR_MATCH_LEVELS,
  PPEWS_CATEGORIES,
  type AarCompleteValidation,
  type AarListItem,
  type AarMatchLevel,
  type AarPatch,
  type AarRecord,
  type AarStatus,
  type CreateAarInput,
  type PpewsCategory,
  type PpewsEntry,
  type PpewsMismatchWarning,
  type PpewsPatch
} from '../../shared/aar'
import { listAttachmentsForAar } from './aar-attachments'
import { listStagesForAar } from './aar-stages'

type AarRow = {
  id: string
  log_entry_id: string | null
  barrel_id: string | null
  status: AarStatus
  match_name: string | null
  match_date_start: string | null
  match_date_end: string | null
  venue: string | null
  match_level: AarMatchLevel | null
  division: string | null
  score: number | null
  score_possible: number | null
  placement: number | null
  field_size: number | null
  rounds_fired: number | null
  mindset: string | null
  rifle_setup: string | null
  goals: string | null
  what_went_right: string | null
  lessons_learned: string | null
  training_plan: string | null
  final_thoughts: string | null
  created_at: string
  updated_at: string
}

type PpewsRow = {
  id: string
  aar_id: string
  category: PpewsCategory
  points_dropped: number
  rating: number | null
  notes: string | null
}

function nowIso(): string {
  return new Date().toISOString()
}

function isMatchLevel(value: unknown): value is AarMatchLevel {
  return typeof value === 'string' && (AAR_MATCH_LEVELS as readonly string[]).includes(value)
}

function isCategory(value: unknown): value is PpewsCategory {
  return typeof value === 'string' && (PPEWS_CATEGORIES as readonly string[]).includes(value)
}

function mapPpews(row: PpewsRow): PpewsEntry {
  return {
    id: row.id,
    aarId: row.aar_id,
    category: row.category,
    pointsDropped: row.points_dropped,
    rating: row.rating,
    notes: row.notes
  }
}

function mapAarCore(row: AarRow): Omit<AarRecord, 'ppews' | 'attachments' | 'stages'> {
  return {
    id: row.id,
    logEntryId: row.log_entry_id,
    barrelId: row.barrel_id,
    status: row.status,
    matchName: row.match_name,
    matchDateStart: row.match_date_start,
    matchDateEnd: row.match_date_end,
    venue: row.venue,
    matchLevel: row.match_level,
    division: row.division,
    score: row.score,
    scorePossible: row.score_possible,
    placement: row.placement,
    fieldSize: row.field_size,
    roundsFired: row.rounds_fired,
    mindset: row.mindset,
    rifleSetup: row.rifle_setup,
    goals: row.goals,
    whatWentRight: row.what_went_right,
    lessonsLearned: row.lessons_learned,
    trainingPlan: row.training_plan,
    finalThoughts: row.final_thoughts,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listPpewsForAar(db: Database.Database, aarId: string): PpewsEntry[] {
  const rows = db
    .prepare(`SELECT * FROM aar_ppews WHERE aar_id = ? ORDER BY category ASC`)
    .all(aarId) as PpewsRow[]
  return rows.map(mapPpews)
}

function ensureDefaultPpews(db: Database.Database, aarId: string): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO aar_ppews (id, aar_id, category, points_dropped, rating, notes)
     VALUES (@id, @aarId, @category, 0, NULL, NULL)`
  )
  for (const category of PPEWS_CATEGORIES) {
    insert.run({ id: randomUUID(), aarId, category })
  }
}

export function getAar(db: Database.Database, id: string): AarRecord | null {
  const row = db.prepare(`SELECT * FROM aar WHERE id = ?`).get(id) as AarRow | undefined
  if (!row) return null
  return {
    ...mapAarCore(row),
    ppews: listPpewsForAar(db, id),
    attachments: listAttachmentsForAar(db, id),
    stages: listStagesForAar(db, id)
  }
}

export function getAarByLogEntryId(db: Database.Database, logEntryId: string): AarRecord | null {
  const row = db.prepare(`SELECT id FROM aar WHERE log_entry_id = ?`).get(logEntryId) as
    | { id: string }
    | undefined
  return row ? getAar(db, row.id) : null
}

export function listAars(db: Database.Database): AarListItem[] {
  const rows = db
    .prepare(
      `SELECT a.*,
        COALESCE((SELECT SUM(points_dropped) FROM aar_ppews p WHERE p.aar_id = a.id), 0) AS total_points
       FROM aar a
       ORDER BY COALESCE(a.match_date_start, a.updated_at) DESC, a.updated_at DESC`
    )
    .all() as Array<AarRow & { total_points: number }>

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    matchName: row.match_name,
    matchDateStart: row.match_date_start,
    matchLevel: row.match_level,
    venue: row.venue,
    placement: row.placement,
    logEntryId: row.log_entry_id,
    updatedAt: row.updated_at,
    totalPointsDropped: Number(row.total_points) || 0
  }))
}

/** Prefill rifle_setup text from available barrel part fields. */
export function formatRifleSetupFromBarrel(
  db: Database.Database,
  barrelId: string | null | undefined
): string | null {
  if (!barrelId) return null
  const part = db
    .prepare(
      `SELECT manufacturer, name, caliber, twist_rate, barrel_life, gunsmith, model
       FROM parts WHERE id = ? AND type = 'Barrel'`
    )
    .get(barrelId) as
    | {
        manufacturer: string
        name: string | null
        caliber: string | null
        twist_rate: number | null
        barrel_life: number | null
        gunsmith: string | null
        model: string | null
      }
    | undefined
  if (!part) return null

  const bits: string[] = []
  if (part.manufacturer?.trim()) bits.push(part.manufacturer.trim())
  if (part.name?.trim()) bits.push(part.name.trim())
  else if (part.model?.trim()) bits.push(part.model.trim())
  if (part.caliber?.trim()) bits.push(part.caliber.trim())
  if (part.twist_rate != null) bits.push(`1:${part.twist_rate} twist`)
  if (part.barrel_life != null) bits.push(`life ${part.barrel_life}`)
  if (part.gunsmith?.trim()) bits.push(`smith ${part.gunsmith.trim()}`)
  return bits.length > 0 ? bits.join(' · ') : null
}

export function createAar(db: Database.Database, input: CreateAarInput = {}): AarRecord {
  if (input.logEntryId) {
    const existing = getAarByLogEntryId(db, input.logEntryId)
    if (existing) return existing
  }

  const id = randomUUID()
  const createdAt = nowIso()
  let matchName = input.matchName ?? null
  let matchDateStart = input.matchDateStart ?? null
  let venue = input.venue ?? null
  let matchLevel = input.matchLevel ?? null
  let placement = input.placement ?? null
  let roundsFired = input.roundsFired ?? null
  let barrelId = input.barrelId ?? null
  let rifleSetup = input.rifleSetup ?? null

  if (input.logEntryId) {
    const log = db
      .prepare(
        `SELECT id, barrel_id, date, location, session_type, placement, rounds_fired
         FROM shooting_logs WHERE id = ?`
      )
      .get(input.logEntryId) as
      | {
          id: string
          barrel_id: string
          date: string
          location: string
          session_type: string
          placement: number | null
          rounds_fired: number
        }
      | undefined
    if (!log) throw new Error(`Log entry not found: ${input.logEntryId}`)
    barrelId = barrelId ?? log.barrel_id
    matchDateStart = matchDateStart ?? log.date
    venue = venue ?? (log.location?.trim() ? log.location : null)
    placement = placement ?? log.placement
    roundsFired = roundsFired ?? log.rounds_fired
    if (!matchLevel) {
      matchLevel = log.session_type === 'Practice' ? 'practice' : 'club'
    }
    if (!matchName) {
      matchName = log.session_type === 'Practice' ? 'Practice session' : 'Match'
    }
  }

  if (!rifleSetup) {
    rifleSetup = formatRifleSetupFromBarrel(db, barrelId)
  }

  if (matchLevel != null && !isMatchLevel(matchLevel)) {
    throw new Error('Invalid match level')
  }

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO aar (
        id, log_entry_id, barrel_id, status, match_name, match_date_start, match_date_end,
        venue, match_level, division, score, score_possible, placement, field_size, rounds_fired,
        mindset, rifle_setup, goals, what_went_right, lessons_learned, training_plan, final_thoughts,
        created_at, updated_at
      ) VALUES (
        @id, @logEntryId, @barrelId, 'draft', @matchName, @matchDateStart, NULL,
        @venue, @matchLevel, NULL, NULL, NULL, @placement, NULL, @roundsFired,
        NULL, @rifleSetup, NULL, NULL, NULL, NULL, NULL,
        @createdAt, @createdAt
      )`
    ).run({
      id,
      logEntryId: input.logEntryId ?? null,
      barrelId,
      matchName,
      matchDateStart,
      venue,
      matchLevel,
      placement,
      roundsFired,
      rifleSetup,
      createdAt
    })
    ensureDefaultPpews(db, id)
  })
  run()

  return getAar(db, id)!
}

export function updateAar(db: Database.Database, id: string, patch: AarPatch): AarRecord {
  const existing = getAar(db, id)
  if (!existing) throw new Error(`AAR not found: ${id}`)

  if (patch.matchLevel !== undefined && patch.matchLevel !== null && !isMatchLevel(patch.matchLevel)) {
    throw new Error('Invalid match level')
  }

  if (patch.logEntryId) {
    const clash = db
      .prepare(`SELECT id FROM aar WHERE log_entry_id = ? AND id != ?`)
      .get(patch.logEntryId, id) as { id: string } | undefined
    if (clash) throw new Error('Another AAR is already linked to that log entry')
  }

  const updatedAt = nowIso()
  db.prepare(
    `UPDATE aar SET
      log_entry_id = @logEntryId,
      barrel_id = @barrelId,
      match_name = @matchName,
      match_date_start = @matchDateStart,
      match_date_end = @matchDateEnd,
      venue = @venue,
      match_level = @matchLevel,
      division = @division,
      score = @score,
      score_possible = @scorePossible,
      placement = @placement,
      field_size = @fieldSize,
      rounds_fired = @roundsFired,
      mindset = @mindset,
      rifle_setup = @rifleSetup,
      goals = @goals,
      what_went_right = @whatWentRight,
      lessons_learned = @lessonsLearned,
      training_plan = @trainingPlan,
      final_thoughts = @finalThoughts,
      updated_at = @updatedAt
    WHERE id = @id`
  ).run({
    id,
    logEntryId: patch.logEntryId !== undefined ? patch.logEntryId : existing.logEntryId,
    barrelId: patch.barrelId !== undefined ? patch.barrelId : existing.barrelId,
    matchName: patch.matchName !== undefined ? patch.matchName : existing.matchName,
    matchDateStart:
      patch.matchDateStart !== undefined ? patch.matchDateStart : existing.matchDateStart,
    matchDateEnd: patch.matchDateEnd !== undefined ? patch.matchDateEnd : existing.matchDateEnd,
    venue: patch.venue !== undefined ? patch.venue : existing.venue,
    matchLevel: patch.matchLevel !== undefined ? patch.matchLevel : existing.matchLevel,
    division: patch.division !== undefined ? patch.division : existing.division,
    score: patch.score !== undefined ? patch.score : existing.score,
    scorePossible: patch.scorePossible !== undefined ? patch.scorePossible : existing.scorePossible,
    placement: patch.placement !== undefined ? patch.placement : existing.placement,
    fieldSize: patch.fieldSize !== undefined ? patch.fieldSize : existing.fieldSize,
    roundsFired: patch.roundsFired !== undefined ? patch.roundsFired : existing.roundsFired,
    mindset: patch.mindset !== undefined ? patch.mindset : existing.mindset,
    rifleSetup: patch.rifleSetup !== undefined ? patch.rifleSetup : existing.rifleSetup,
    goals: patch.goals !== undefined ? patch.goals : existing.goals,
    whatWentRight: patch.whatWentRight !== undefined ? patch.whatWentRight : existing.whatWentRight,
    lessonsLearned:
      patch.lessonsLearned !== undefined ? patch.lessonsLearned : existing.lessonsLearned,
    trainingPlan: patch.trainingPlan !== undefined ? patch.trainingPlan : existing.trainingPlan,
    finalThoughts:
      patch.finalThoughts !== undefined ? patch.finalThoughts : existing.finalThoughts,
    updatedAt
  })

  return getAar(db, id)!
}

export function upsertPpews(db: Database.Database, aarId: string, patches: PpewsPatch[]): AarRecord {
  const existing = getAar(db, aarId)
  if (!existing) throw new Error(`AAR not found: ${aarId}`)

  const run = db.transaction(() => {
    ensureDefaultPpews(db, aarId)
    const update = db.prepare(
      `UPDATE aar_ppews SET
        points_dropped = @pointsDropped,
        rating = @rating,
        notes = @notes
       WHERE aar_id = @aarId AND category = @category`
    )
    for (const patch of patches) {
      if (!isCategory(patch.category)) throw new Error(`Invalid PPEWS category: ${patch.category}`)
      const current = existing.ppews.find((p) => p.category === patch.category)
      const points =
        patch.pointsDropped !== undefined ? patch.pointsDropped : (current?.pointsDropped ?? 0)
      if (!Number.isInteger(points) || points < 0) {
        throw new Error('PPEWS points dropped must be an integer ≥ 0')
      }
      let rating =
        patch.rating !== undefined ? patch.rating : (current?.rating ?? null)
      if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
        throw new Error('PPEWS rating must be 1–5 or empty')
      }
      update.run({
        aarId,
        category: patch.category,
        pointsDropped: points,
        rating,
        notes: patch.notes !== undefined ? patch.notes : (current?.notes ?? null)
      })
    }
    db.prepare(`UPDATE aar SET updated_at = ? WHERE id = ?`).run(nowIso(), aarId)
  })
  run()
  return getAar(db, aarId)!
}

export function validateAarComplete(aar: AarRecord): AarCompleteValidation {
  const missing: string[] = []
  if (!aar.matchName?.trim()) missing.push('matchName')
  if (!aar.matchDateStart?.trim()) missing.push('matchDateStart')
  if (!aar.matchLevel) missing.push('matchLevel')
  for (const category of PPEWS_CATEGORIES) {
    if (!aar.ppews.some((p) => p.category === category)) {
      missing.push(`ppews:${category}`)
    }
  }
  return { ok: missing.length === 0, missing }
}

export function computePpewsMismatch(aar: AarRecord): PpewsMismatchWarning {
  const ppewsTotal = aar.ppews.reduce((sum, row) => sum + (row.pointsDropped || 0), 0)
  if (aar.score == null || aar.scorePossible == null) {
    return { warned: false, message: null, scoreDropped: null, ppewsTotal }
  }
  if (!Number.isFinite(aar.score) || !Number.isFinite(aar.scorePossible)) {
    return { warned: false, message: null, scoreDropped: null, ppewsTotal }
  }
  const scoreDropped = Math.max(0, aar.scorePossible - aar.score)
  if (Math.abs(scoreDropped - ppewsTotal) <= 0.5) {
    return { warned: false, message: null, scoreDropped, ppewsTotal }
  }
  return {
    warned: true,
    message: `PPEWS total (${ppewsTotal}) does not match score dropped (${scoreDropped} from ${aar.score}/${aar.scorePossible}). You can still save — this is a soft check.`,
    scoreDropped,
    ppewsTotal
  }
}

export function completeAar(db: Database.Database, id: string): AarRecord {
  const aar = getAar(db, id)
  if (!aar) throw new Error(`AAR not found: ${id}`)
  const validation = validateAarComplete(aar)
  if (!validation.ok) {
    throw new Error(`AAR is incomplete: missing ${validation.missing.join(', ')}`)
  }
  db.prepare(`UPDATE aar SET status = 'complete', updated_at = ? WHERE id = ?`).run(nowIso(), id)
  return getAar(db, id)!
}

export function reopenAarDraft(db: Database.Database, id: string): AarRecord {
  const aar = getAar(db, id)
  if (!aar) throw new Error(`AAR not found: ${id}`)
  db.prepare(`UPDATE aar SET status = 'draft', updated_at = ? WHERE id = ?`).run(nowIso(), id)
  return getAar(db, id)!
}

export function deleteAar(db: Database.Database, id: string): void {
  const aar = getAar(db, id)
  if (!aar) return
  db.prepare(`DELETE FROM aar WHERE id = ?`).run(id)
}

export function aarToMarkdown(aar: AarRecord): string {
  const lines: string[] = []
  lines.push(`# ${aar.matchName?.trim() || 'After-Action Review'}`)
  lines.push('')
  lines.push(`- **Status:** ${aar.status}`)
  if (aar.matchDateStart) lines.push(`- **Date:** ${aar.matchDateStart}${aar.matchDateEnd ? ` → ${aar.matchDateEnd}` : ''}`)
  if (aar.venue) lines.push(`- **Venue:** ${aar.venue}`)
  if (aar.matchLevel) lines.push(`- **Level:** ${aar.matchLevel}`)
  if (aar.division) lines.push(`- **Division:** ${aar.division}`)
  if (aar.score != null || aar.scorePossible != null) {
    lines.push(`- **Score:** ${aar.score ?? '—'} / ${aar.scorePossible ?? '—'}`)
  }
  if (aar.placement != null) {
    lines.push(
      `- **Placement:** ${aar.placement}${aar.fieldSize != null ? ` of ${aar.fieldSize}` : ''}`
    )
  }
  if (aar.roundsFired != null) lines.push(`- **Rounds:** ${aar.roundsFired}`)
  lines.push('')
  lines.push('## PPEWS')
  for (const category of PPEWS_CATEGORIES) {
    const row = aar.ppews.find((p) => p.category === category)
    lines.push(
      `- **${category}:** ${row?.pointsDropped ?? 0} pts${row?.rating != null ? ` · rating ${row.rating}/5` : ''}${row?.notes?.trim() ? ` — ${row.notes.trim()}` : ''}`
    )
  }
  const narrative: Array<[string, string | null]> = [
    ['Mindset', aar.mindset],
    ['Rifle setup', aar.rifleSetup],
    ['Goals', aar.goals],
    ['What went right', aar.whatWentRight],
    ['Lessons learned', aar.lessonsLearned],
    ['Training plan', aar.trainingPlan],
    ['Final thoughts', aar.finalThoughts]
  ]
  for (const [title, body] of narrative) {
    if (!body?.trim()) continue
    lines.push('')
    lines.push(`## ${title}`)
    lines.push(body.trim())
  }
  const confirmed = aar.stages.filter((s) => s.confirmedAt)
  if (confirmed.length > 0) {
    lines.push('')
    lines.push('## Course of fire (confirmed)')
    for (const stage of confirmed) {
      lines.push(
        `- Stage ${stage.stageNumber ?? '?'} ${stage.stageName ?? ''} — ${stage.description ?? ''}`.trim()
      )
    }
  }
  lines.push('')
  return lines.join('\n')
}
