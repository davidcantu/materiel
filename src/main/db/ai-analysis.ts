/**
 * Persist AI Coach analysis results (no API keys).
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
import type {
  AiAnalysisListItem,
  AiCoachAnalysisResult,
  AiCoachScope
} from '../../shared/ai-coach'

type AnalysisRow = {
  id: string
  created_at: string
  provider: string
  model: string
  scope_json: string
  result_json: string
  usage_json: string | null
}

function parseScope(raw: string): AiCoachScope {
  try {
    return JSON.parse(raw) as AiCoachScope
  } catch {
    return {}
  }
}

function parseResult(raw: string): AiCoachAnalysisResult {
  try {
    return JSON.parse(raw) as AiCoachAnalysisResult
  } catch {
    return {
      summary: '',
      strengths: [],
      focusAreas: [],
      drills: [],
      caveats: ['Stored analysis JSON could not be parsed.']
    }
  }
}

function mapRow(row: AnalysisRow): AiAnalysisListItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    provider: row.provider,
    model: row.model,
    scope: parseScope(row.scope_json),
    result: parseResult(row.result_json)
  }
}

export function saveAiAnalysis(
  db: Database.Database,
  input: {
    provider: string
    model: string
    scope: AiCoachScope
    result: AiCoachAnalysisResult
    usage?: { inputTokens?: number; outputTokens?: number } | null
  }
): AiAnalysisListItem {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  db.prepare(
    `INSERT INTO ai_analysis (id, created_at, provider, model, scope_json, result_json, usage_json)
     VALUES (@id, @createdAt, @provider, @model, @scopeJson, @resultJson, @usageJson)`
  ).run({
    id,
    createdAt,
    provider: input.provider,
    model: input.model,
    scopeJson: JSON.stringify(input.scope ?? {}),
    resultJson: JSON.stringify(input.result),
    usageJson: input.usage ? JSON.stringify(input.usage) : null
  })
  return getAiAnalysis(db, id)!
}

export function getAiAnalysis(db: Database.Database, id: string): AiAnalysisListItem | null {
  const row = db.prepare(`SELECT * FROM ai_analysis WHERE id = ?`).get(id) as AnalysisRow | undefined
  return row ? mapRow(row) : null
}

export function listAiAnalyses(db: Database.Database, limit = 50): AiAnalysisListItem[] {
  const rows = db
    .prepare(`SELECT * FROM ai_analysis ORDER BY created_at DESC LIMIT ?`)
    .all(Math.max(1, Math.min(limit, 200))) as AnalysisRow[]
  return rows.map(mapRow)
}

export function countAiAnalyses(db: Database.Database): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM ai_analysis`).get() as { c: number }).c
}
