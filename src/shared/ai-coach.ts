/** AI Coach analysis / COF extraction types (no secrets). */

import type { AarMatchLevel, PpewsCategory, TrendsFilters } from './aar'
import type { AiProviderId } from './ai'

export type AiCoachScope = {
  filters?: TrendsFilters
  aarIds?: string[]
  includeDrafts?: boolean
}

export type AiCoachFocusArea = {
  category: PpewsCategory | 'general'
  summary: string
  evidence: string[]
}

export type AiCoachDrill = {
  title: string
  description: string
  category: PpewsCategory | 'general'
}

export type AiCoachAnalysisResult = {
  summary: string
  strengths: string[]
  focusAreas: AiCoachFocusArea[]
  drills: AiCoachDrill[]
  caveats: string[]
}

export type AiCoachPreviewPayload = {
  provider: AiProviderId
  model: string
  aarCount: number
  localStats: {
    categories: Array<{ category: PpewsCategory; totalPointsDropped: number }>
    topLeak: PpewsCategory | null
  }
  promptPreview: string
  estimatedInputChars: number
}

export type AiCoachAnalyzeInput = {
  scope?: AiCoachScope
  /** When false, only build preview (no network). Default true for send. */
  send?: boolean
}

export type AiCoachAnalyzeResult =
  | {
      ok: true
      preview: AiCoachPreviewPayload
      analysis: AiCoachAnalysisResult | null
      analysisId: string | null
      usage: { inputTokens?: number; outputTokens?: number } | null
    }
  | { ok: false; error: string; preview?: AiCoachPreviewPayload }

export type AiCofExtractionTarget = {
  label?: string
  distance?: string | number | null
  notes?: string | null
}

export type AiCofExtractionStage = {
  stageNumber?: number | null
  stageName?: string | null
  description?: string | null
  targets?: AiCofExtractionTarget[]
  roundCount?: number | null
  parTimeSec?: number | null
  handwrittenNotes?: string | null
}

export type AiCofExtractionResult = {
  stages: AiCofExtractionStage[]
  notes: string | null
}

export type AiExtractCofInput = {
  aarId: string
  attachmentId: string
}

export type AiExtractCofResult =
  | { ok: true; extraction: AiCofExtractionResult; attachmentId: string }
  | { ok: false; error: string }

export type AiAnalysisListItem = {
  id: string
  createdAt: string
  provider: string
  model: string
  scope: AiCoachScope
  result: AiCoachAnalysisResult
}

export const AI_COACH_FEATURE_STATUS = {
  needsKey: 'Save an API key in Settings → AI API before analyzing.',
  needsModel: 'Choose a model in Settings → AI API.',
  needsCapability: 'Run Test connection in Settings so analysis is marked ready.',
  needsVision: 'Vision is not ready for this provider/model. Use JPEG/PNG and re-check.',
  emptyScope: 'No complete AARs match this scope yet.',
  heicUnsupported: 'HEIC is not supported on this platform yet — export as JPEG or PNG.',
  pdfSoftFail: 'PDF page extraction is not available yet — attach JPEG/PNG stage photos.'
} as const

export type AiCoachMatchLevelFilter = AarMatchLevel | 'all'
