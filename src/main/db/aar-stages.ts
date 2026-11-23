/**
 * Confirmed (and draft) COF stage rows for an AAR.
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
import type { AarStage, AarStageInput, AarStageTarget } from '../../shared/aar'

type StageRow = {
  id: string
  aar_id: string
  attachment_id: string | null
  stage_number: number | null
  stage_name: string | null
  description: string | null
  targets_json: string | null
  round_count: number | null
  par_time_sec: number | null
  handwritten_notes: string | null
  confirmed_at: string | null
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseTargets(raw: string | null): AarStageTarget[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => ({
        label: typeof item.label === 'string' ? item.label : undefined,
        distance:
          typeof item.distance === 'string' || typeof item.distance === 'number'
            ? item.distance
            : null,
        notes: typeof item.notes === 'string' ? item.notes : null
      }))
  } catch {
    return []
  }
}

function mapStage(row: StageRow): AarStage {
  return {
    id: row.id,
    aarId: row.aar_id,
    attachmentId: row.attachment_id,
    stageNumber: row.stage_number,
    stageName: row.stage_name,
    description: row.description,
    targets: parseTargets(row.targets_json),
    roundCount: row.round_count,
    parTimeSec: row.par_time_sec,
    handwrittenNotes: row.handwritten_notes,
    confirmedAt: row.confirmed_at
  }
}

export function listStagesForAar(db: Database.Database, aarId: string): AarStage[] {
  const rows = db
    .prepare(
      `SELECT * FROM aar_stage WHERE aar_id = ?
       ORDER BY COALESCE(stage_number, 9999) ASC, id ASC`
    )
    .all(aarId) as StageRow[]
  return rows.map(mapStage)
}

export function replaceStages(
  db: Database.Database,
  aarId: string,
  stages: AarStageInput[],
  options?: { requireConfirm?: boolean }
): AarStage[] {
  const aar = db.prepare(`SELECT id FROM aar WHERE id = ?`).get(aarId) as { id: string } | undefined
  if (!aar) throw new Error(`AAR not found: ${aarId}`)

  const requireConfirm = options?.requireConfirm !== false
  const run = db.transaction(() => {
    db.prepare(`DELETE FROM aar_stage WHERE aar_id = ?`).run(aarId)
    const insert = db.prepare(
      `INSERT INTO aar_stage (
        id, aar_id, attachment_id, stage_number, stage_name, description,
        targets_json, round_count, par_time_sec, handwritten_notes, confirmed_at
      ) VALUES (
        @id, @aarId, @attachmentId, @stageNumber, @stageName, @description,
        @targetsJson, @roundCount, @parTimeSec, @handwrittenNotes, @confirmedAt
      )`
    )
    for (const stage of stages) {
      const confirmed = Boolean(stage.confirmed)
      if (requireConfirm && !confirmed) {
        // Still persist unconfirmed suggestions so the UI can show them,
        // but confirmed_at stays null until the user confirms.
      }
      insert.run({
        id: stage.id?.trim() || randomUUID(),
        aarId,
        attachmentId: stage.attachmentId ?? null,
        stageNumber: stage.stageNumber ?? null,
        stageName: stage.stageName ?? null,
        description: stage.description ?? null,
        targetsJson: JSON.stringify(stage.targets ?? []),
        roundCount: stage.roundCount ?? null,
        parTimeSec: stage.parTimeSec ?? null,
        handwrittenNotes: stage.handwrittenNotes ?? null,
        confirmedAt: confirmed ? nowIso() : null
      })
    }
    db.prepare(`UPDATE aar SET updated_at = ? WHERE id = ?`).run(nowIso(), aarId)
  })
  run()
  return listStagesForAar(db, aarId)
}

export function confirmStages(
  db: Database.Database,
  aarId: string,
  stages: AarStageInput[]
): AarStage[] {
  return replaceStages(
    db,
    aarId,
    stages.map((s) => ({ ...s, confirmed: true })),
    { requireConfirm: false }
  )
}

export function deleteStagesForAar(db: Database.Database, aarId: string): void {
  db.prepare(`DELETE FROM aar_stage WHERE aar_id = ?`).run(aarId)
}
