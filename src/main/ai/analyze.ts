/**
 * AI Coach analyze: local PPEWS stats → preview → optional send + validate.
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import { AI_COACH_SYSTEM_PROMPT } from '../../shared/ai-coach-prompts'
import {
  AI_COACH_FEATURE_STATUS,
  type AiCoachAnalysisResult,
  type AiCoachAnalyzeInput,
  type AiCoachAnalyzeResult,
  type AiCoachFocusArea,
  type AiCoachPreviewPayload,
  type AiCoachScope
} from '../../shared/ai-coach'
import { PPEWS_CATEGORIES, type AarRecord, type PpewsCategory } from '../../shared/aar'
import { getAar, listAars } from '../db/aar'
import { saveAiAnalysis } from '../db/ai-analysis'
import { getPpewsTrends } from '../db/trends'
import { mapUnknownError } from './errors'
import { loadApiKey } from './key-store'
import { loadAiPrefs } from './prefs'
import { createLLMProvider, type FetchImpl } from './providers'
import type { AiServiceDeps } from './service'

const CATEGORY_SET = new Set<string>([...PPEWS_CATEGORIES, 'general'])

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as unknown
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    return JSON.parse(fence[1].trim()) as unknown
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown
  }
  throw new Error('Model response did not contain JSON.')
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function validateCoachAnalysis(raw: unknown): AiCoachAnalysisResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Analysis JSON must be an object.')
  }
  const obj = raw as Record<string, unknown>
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
  if (!summary) throw new Error('Analysis summary is required.')

  const focusAreas: AiCoachFocusArea[] = []
  if (Array.isArray(obj.focusAreas)) {
    for (const item of obj.focusAreas) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const category = typeof row.category === 'string' ? row.category : 'general'
      if (!CATEGORY_SET.has(category)) continue
      const focusSummary = typeof row.summary === 'string' ? row.summary.trim() : ''
      if (!focusSummary) continue
      focusAreas.push({
        category: category as AiCoachFocusArea['category'],
        summary: focusSummary,
        evidence: asStringArray(row.evidence)
      })
    }
  }

  const drills: AiCoachAnalysisResult['drills'] = []
  if (Array.isArray(obj.drills)) {
    for (const item of obj.drills) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const title = typeof row.title === 'string' ? row.title.trim() : ''
      const description = typeof row.description === 'string' ? row.description.trim() : ''
      const category = typeof row.category === 'string' ? row.category : 'general'
      if (!title || !description || !CATEGORY_SET.has(category)) continue
      drills.push({
        title,
        description,
        category: category as AiCoachFocusArea['category']
      })
    }
  }

  return {
    summary,
    strengths: asStringArray(obj.strengths),
    focusAreas,
    drills,
    caveats: asStringArray(obj.caveats)
  }
}

function resolveAars(db: Database.Database, scope: AiCoachScope): AarRecord[] {
  if (scope.aarIds && scope.aarIds.length > 0) {
    return scope.aarIds
      .map((id) => getAar(db, id))
      .filter((a): a is AarRecord => Boolean(a))
      .filter((a) => scope.includeDrafts || a.status === 'complete')
  }

  const trends = getPpewsTrends(db, scope.filters ?? {})
  const ids = new Set(trends.series.map((s) => s.aarId))
  // Also include complete AARs that matched filters even with 0 series edges
  const listed = listAars(db).filter((item) => {
    if (!scope.includeDrafts && item.status !== 'complete') return false
    if (scope.filters?.matchLevel && item.matchLevel !== scope.filters.matchLevel) return false
    if (scope.filters?.fromDate && (item.matchDateStart ?? '') < scope.filters.fromDate) return false
    if (scope.filters?.toDate && (item.matchDateStart ?? '') > scope.filters.toDate) return false
    return true
  })
  for (const item of listed) ids.add(item.id)

  return [...ids]
    .map((id) => getAar(db, id))
    .filter((a): a is AarRecord => Boolean(a))
}

function buildUserPrompt(aars: AarRecord[], localStats: AiCoachPreviewPayload['localStats']): string {
  const excerpts = aars.slice(0, 25).map((aar) => {
    const ppews = aar.ppews
      .map((p) => `${p.category}:${p.pointsDropped}`)
      .join(', ')
    const stages = aar.stages
      .filter((s) => s.confirmedAt)
      .map((s) => `Stage ${s.stageNumber ?? '?'}: ${s.stageName ?? s.description ?? ''}`.trim())
      .join('; ')
    return [
      `AAR ${aar.matchName ?? aar.id} (${aar.matchDateStart ?? 'no-date'}, ${aar.matchLevel ?? 'n/a'})`,
      `PPEWS: ${ppews}`,
      aar.whatWentRight ? `Right: ${aar.whatWentRight.slice(0, 400)}` : null,
      aar.lessonsLearned ? `Lessons: ${aar.lessonsLearned.slice(0, 400)}` : null,
      aar.trainingPlan ? `Plan: ${aar.trainingPlan.slice(0, 400)}` : null,
      stages ? `COF (confirmed text only): ${stages.slice(0, 500)}` : null
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [
    'Local PPEWS totals:',
    ...localStats.categories.map((c) => `- ${c.category}: ${c.totalPointsDropped}`),
    `Top leak: ${localStats.topLeak ?? 'none'}`,
    '',
    'AAR excerpts:',
    excerpts.join('\n\n') || '(none)'
  ].join('\n')
}

export async function analyzeWithCoach(
  db: Database.Database,
  input: AiCoachAnalyzeInput = {},
  deps?: AiServiceDeps & { fetchImpl?: FetchImpl }
): Promise<AiCoachAnalyzeResult> {
  const prefs = loadAiPrefs(deps)
  const provider = prefs.provider
  const model = prefs.modelByProvider[provider] ?? null
  const apiKey = loadApiKey(provider, deps)
  const scope = input.scope ?? {}
  const send = input.send !== false

  if (!apiKey) {
    return { ok: false, error: AI_COACH_FEATURE_STATUS.needsKey }
  }
  if (!model) {
    return { ok: false, error: AI_COACH_FEATURE_STATUS.needsModel }
  }

  const cache = prefs.capabilityCache
  if (!cache || cache.capabilities.analysisReady !== 'ok') {
    return { ok: false, error: AI_COACH_FEATURE_STATUS.needsCapability }
  }

  const aars = resolveAars(db, scope)
  if (aars.length === 0) {
    return { ok: false, error: AI_COACH_FEATURE_STATUS.emptyScope }
  }

  const trends = getPpewsTrends(db, scope.filters ?? {})
  const localStats = {
    categories: trends.categories.map((c) => ({
      category: c.category as PpewsCategory,
      totalPointsDropped: c.totalPointsDropped
    })),
    topLeak: trends.topLeak
  }
  const userPrompt = buildUserPrompt(aars, localStats)
  const preview: AiCoachPreviewPayload = {
    provider,
    model,
    aarCount: aars.length,
    localStats,
    promptPreview: userPrompt.slice(0, 4000),
    estimatedInputChars: userPrompt.length + AI_COACH_SYSTEM_PROMPT.length
  }

  if (!send) {
    return { ok: true, preview, analysis: null, analysisId: null, usage: null }
  }

  const llm = createLLMProvider(provider, {
    apiKey,
    fetchImpl: deps?.fetchImpl
  })

  let lastError: string | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await llm.complete({
        model,
        system: AI_COACH_SYSTEM_PROMPT,
        prompt:
          attempt === 0
            ? userPrompt
            : `${userPrompt}\n\nPrevious response was invalid JSON. Reply with ONLY the JSON object.`,
        maxTokens: 2048
      })
      const parsed = extractJsonObject(completion.text)
      const analysis = validateCoachAnalysis(parsed)
      const saved = saveAiAnalysis(db, {
        provider,
        model,
        scope,
        result: analysis,
        usage: completion.usage ?? null
      })
      return {
        ok: true,
        preview,
        analysis,
        analysisId: saved.id,
        usage: completion.usage ?? null
      }
    } catch (error) {
      lastError = mapUnknownError(error, apiKey)
    }
  }

  return { ok: false, error: lastError ?? 'Analysis failed.', preview }
}
