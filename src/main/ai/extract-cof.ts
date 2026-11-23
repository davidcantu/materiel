/**
 * COF vision extraction — returns suggestions; caller must confirm before use.
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import { AI_COF_EXTRACTION_SYSTEM_PROMPT } from '../../shared/ai-coach-prompts'
import {
  AI_COACH_FEATURE_STATUS,
  type AiCofExtractionResult,
  type AiCofExtractionStage,
  type AiExtractCofInput,
  type AiExtractCofResult
} from '../../shared/ai-coach'
import {
  absoluteAttachmentPath,
  getAttachment,
  setAttachmentAiPath,
  writeAiDerivative
} from '../db/aar-attachments'
import { join } from 'path'
import { mapUnknownError } from './errors'
import { prepareImageForVision } from './images'
import { loadApiKey } from './key-store'
import { loadAiPrefs } from './prefs'
import { createLLMProvider, type FetchImpl } from './providers'
import type { AiServiceDeps } from './service'

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) return JSON.parse(trimmed) as unknown
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) return JSON.parse(fence[1].trim()) as unknown
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as unknown
  throw new Error('Model response did not contain JSON.')
}

export function validateCofExtraction(raw: unknown): AiCofExtractionResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('COF extraction JSON must be an object.')
  }
  const obj = raw as Record<string, unknown>
  const stages: AiCofExtractionStage[] = []
  if (Array.isArray(obj.stages)) {
    for (const item of obj.stages) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const targets = Array.isArray(row.targets)
        ? row.targets
            .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object')
            .map((t) => ({
              label: typeof t.label === 'string' ? t.label : undefined,
              distance:
                typeof t.distance === 'string' || typeof t.distance === 'number'
                  ? t.distance
                  : null,
              notes: typeof t.notes === 'string' ? t.notes : null
            }))
        : []
      stages.push({
        stageNumber: typeof row.stageNumber === 'number' ? row.stageNumber : null,
        stageName: typeof row.stageName === 'string' ? row.stageName : null,
        description: typeof row.description === 'string' ? row.description : null,
        targets,
        roundCount: typeof row.roundCount === 'number' ? row.roundCount : null,
        parTimeSec: typeof row.parTimeSec === 'number' ? row.parTimeSec : null,
        handwrittenNotes:
          typeof row.handwrittenNotes === 'string' ? row.handwrittenNotes : null
      })
    }
  }
  return {
    stages,
    notes: typeof obj.notes === 'string' ? obj.notes : null
  }
}

export async function extractCofFromAttachment(
  db: Database.Database,
  input: AiExtractCofInput,
  deps?: AiServiceDeps & { fetchImpl?: FetchImpl; userDataPath?: string }
): Promise<AiExtractCofResult> {
  const prefs = loadAiPrefs(deps)
  const provider = prefs.provider
  const model = prefs.modelByProvider[provider] ?? null
  const apiKey = loadApiKey(provider, deps)

  if (!apiKey) return { ok: false, error: AI_COACH_FEATURE_STATUS.needsKey }
  if (!model) return { ok: false, error: AI_COACH_FEATURE_STATUS.needsModel }

  const cache = prefs.capabilityCache
  if (!cache || cache.capabilities.analysisReady !== 'ok') {
    return { ok: false, error: AI_COACH_FEATURE_STATUS.needsCapability }
  }

  const attachment = getAttachment(db, input.attachmentId)
  if (!attachment || attachment.aarId !== input.aarId) {
    return { ok: false, error: 'Attachment not found for this AAR.' }
  }

  const abs = absoluteAttachmentPath(attachment.relativePath, {
    userDataPath: deps?.userDataPath
  })

  let prepared
  try {
    prepared = prepareImageForVision({
      absolutePath: abs,
      mimeType: attachment.mimeType,
      originalFilename: attachment.originalFilename
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : AI_COACH_FEATURE_STATUS.heicUnsupported
    }
  }

  const aiRel = join(attachment.aarId, `${attachment.id}.ai.jpg`)
  writeAiDerivative(aiRel, prepared.bytes, { userDataPath: deps?.userDataPath })
  setAttachmentAiPath(db, attachment.id, aiRel, { userDataPath: deps?.userDataPath })

  // Mark vision capability as exercised (soft — still ok if model rejects).
  const llm = createLLMProvider(provider, {
    apiKey,
    fetchImpl: deps?.fetchImpl,
    timeoutMs: 60_000
  })

  try {
    const completion = await llm.complete({
      model,
      system: AI_COF_EXTRACTION_SYSTEM_PROMPT,
      prompt:
        'Extract the course of fire / stage brief from this image. Return JSON only.',
      maxTokens: 2048,
      images: [{ mimeType: prepared.mimeType, base64: prepared.base64 }]
    })
    const parsed = extractJsonObject(completion.text)
    const extraction = validateCofExtraction(parsed)
    return { ok: true, extraction, attachmentId: attachment.id }
  } catch (error) {
    const message = mapUnknownError(error, apiKey)
    if (/vision|image|multimodal|does not support/i.test(message)) {
      return { ok: false, error: AI_COACH_FEATURE_STATUS.needsVision }
    }
    return { ok: false, error: message }
  }
}
