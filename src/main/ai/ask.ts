/**
 * Materiel AI Assistant — freeform Q&A over local inventory/builds/logs.
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import type {
  AiApplyInventorySuggestionInput,
  AiAssistantAskInput,
  AiAssistantAskResult,
  AiInventorySuggestion
} from '../../shared/ai-assistant'
import { listAmmoInventory } from '../db/ammo'
import { listAars } from '../db/aar'
import { listParts, updatePart, type UpdatePartInput } from '../db/parts'
import { listShootingLogs } from '../db/shooting-logs'
import { listSystems } from '../db/systems'
import type { AiPrivacyPrefs } from '../../shared/ai-privacy'
import { DEFAULT_AI_PRIVACY_PREFS } from '../../shared/ai-privacy'
import { mapUnknownError } from './errors'
import { loadApiKey } from './key-store'
import { loadAiPrefs } from './prefs'
import { createLLMProvider, type FetchImpl } from './providers'
import type { AiServiceDeps } from './service'

const SYSTEM_PROMPT = `You are Materiel AI — a practical firearms armory and training coach inside a local desktop tracker.
Answer using ONLY the local data provided. Be concrete, concise, and actionable.
Never invent serial numbers, round counts, or match scores that are not in the data.
If data is thin, say what is missing and still give useful next steps.

Always reply with a single JSON object (no markdown fence required):
{
  "answer": "Markdown string for the user. Use short paragraphs and bullet lists.",
  "inventorySuggestions": [
    {
      "partId": "exact id from the inventory list",
      "label": "human label for the part",
      "field": "one of: gunsmith, caliber, twistRate, barrelLife, maintenanceInterval, notes, model, name, muzzleType",
      "currentValue": "string or null",
      "suggestedValue": "string to write",
      "reason": "why this fill helps"
    }
  ]
}

Only include inventorySuggestions when the user asks to fill inventory gaps or improve incomplete part records.
Prefer empty inventorySuggestions [] for general advice.
Allowed muzzleType values: "Suppressor" or "Brake".
Numeric fields (twistRate, barrelLife, maintenanceInterval) must be digit strings.`

const ALLOWED_FIELDS = new Set([
  'gunsmith',
  'caliber',
  'twistRate',
  'barrelLife',
  'maintenanceInterval',
  'notes',
  'model',
  'name',
  'muzzleType'
])

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

function parseSuggestions(raw: unknown): AiInventorySuggestion[] {
  if (!Array.isArray(raw)) return []
  const out: AiInventorySuggestion[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const partId = typeof row.partId === 'string' ? row.partId.trim() : ''
    const field = typeof row.field === 'string' ? row.field.trim() : ''
    const suggestedValue =
      typeof row.suggestedValue === 'string' ? row.suggestedValue.trim() : ''
    if (!partId || !ALLOWED_FIELDS.has(field) || !suggestedValue) continue
    out.push({
      partId,
      label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : partId,
      field,
      currentValue:
        row.currentValue === null || row.currentValue === undefined
          ? null
          : String(row.currentValue),
      suggestedValue,
      reason: typeof row.reason === 'string' ? row.reason.trim() : ''
    })
  }
  return out.slice(0, 25)
}

function buildLocalContext(db: Database.Database, privacy: AiPrivacyPrefs): string {
  const parts = listParts(db).slice(0, 80)
  const systems = listSystems(db).slice(0, 40)
  const logs = listShootingLogs(db).slice(0, 30)
  const ammo = listAmmoInventory(db).slice(0, 30)
  const aars = listAars(db).slice(0, 15)

  const partLines = parts.map((p) => {
    const bits = [
      `id=${p.id}`,
      `type=${p.type}`,
      `status=${p.status}`,
      // Serial numbers are never included (2A minimization).
      privacy.includeEquipmentDetail ? `mfr=${p.manufacturer}` : null,
      privacy.includeEquipmentDetail && p.model ? `model=${p.model}` : null,
      privacy.includeEquipmentDetail && p.name ? `name=${p.name}` : null,
      privacy.includeEquipmentDetail && p.caliber ? `caliber=${p.caliber}` : null,
      privacy.includeEquipmentDetail && p.gunsmith ? `gunsmith=${p.gunsmith}` : null,
      p.twistRate != null ? `twist=${p.twistRate}` : 'twist=?',
      p.barrelLife != null ? `life=${p.barrelLife}` : 'life=?',
      p.maintenanceInterval != null ? `maintEvery=${p.maintenanceInterval}` : 'maintEvery=?',
      `rounds=${p.totalRoundCount}`,
      `afterClean=${p.roundsAfterCleaning}`,
      p.muzzleType ? `muzzle=${p.muzzleType}` : null,
      privacy.includeNotes && p.notes ? `notes=${p.notes.slice(0, 80)}` : null,
      `platforms=${p.platforms.join(',')}`
    ]
    return `- ${bits.filter(Boolean).join(' | ')}`
  })

  const systemLines = systems.map((s) => {
    return `- id=${s.id} | ${s.name} | ${s.platform} | ${s.buildType} | rounds=${s.totalRounds} | action=${s.actionId} | barrel=${s.barrelId}`
  })

  const logLines = logs.map((l) => {
    const location =
      privacy.includeLocations && l.location ? `location=${l.location}` : 'location=redacted'
    return `- ${l.date} | ${l.sessionType} | system=${l.systemId ?? 'n/a'} | rounds=${l.roundsFired} | ${location} | place=${l.placement ?? 'n/a'} | pctWinner=${l.percentOfWinner ?? 'n/a'}`
  })

  const ammoLines = ammo.map((a) => {
    if (!privacy.includeEquipmentDetail) {
      return `- caliber=${a.caliber} | type=${a.type} | onHand=${a.quantity}`
    }
    return `- ${a.manufacturer ?? 'n/a'} ${a.caliber} (${a.type}) | onHand=${a.quantity} | name=${a.name}`
  })

  const aarLines = aars.map((a) => {
    const venue =
      privacy.includeLocations && a.venue ? `venue=${a.venue}` : null
    return [
      `- ${a.matchName ?? a.id}`,
      a.matchDateStart ?? 'no-date',
      a.status,
      `place=${a.placement ?? 'n/a'}`,
      `level=${a.matchLevel ?? 'n/a'}`,
      venue
    ]
      .filter(Boolean)
      .join(' | ')
  })

  return [
    '## Inventory parts (serial numbers omitted)',
    partLines.join('\n') || '(none)',
    '',
    '## Builds',
    systemLines.join('\n') || '(none)',
    '',
    '## Recent shooting logs',
    logLines.join('\n') || '(none)',
    '',
    '## Ammo on hand',
    ammoLines.join('\n') || '(none)',
    '',
    '## Recent AARs',
    aarLines.join('\n') || '(none)',
    '',
    `## Privacy filters applied: locations=${privacy.includeLocations ? 'on' : 'off'}, notes=${privacy.includeNotes ? 'on' : 'off'}, equipmentDetail=${privacy.includeEquipmentDetail ? 'on' : 'off'}`
  ].join('\n')
}

export async function askAssistant(
  db: Database.Database,
  input: AiAssistantAskInput,
  deps?: AiServiceDeps & { fetchImpl?: FetchImpl }
): Promise<AiAssistantAskResult> {
  const prompt = typeof input?.prompt === 'string' ? input.prompt.trim() : ''
  if (!prompt) {
    return { ok: false, error: 'Ask a question first.' }
  }
  if (prompt.length > 4000) {
    return { ok: false, error: 'Prompt is too long (max 4000 characters).' }
  }

  const prefs = loadAiPrefs(deps)
  const provider = prefs.provider
  const model = prefs.modelByProvider[provider] ?? null
  const apiKey = loadApiKey(provider, deps)
  const privacy = prefs.privacy ?? { ...DEFAULT_AI_PRIVACY_PREFS }

  if (!apiKey) {
    return { ok: false, error: 'Add an AI API key in Settings to unlock AI View.' }
  }
  if (!model) {
    return { ok: false, error: 'Choose a model in Settings before asking AI View.' }
  }

  const context = buildLocalContext(db, privacy)
  const modeHint =
    input.mode === 'inventory'
      ? 'Mode: inventory fill. Prefer concrete inventorySuggestions for incomplete fields.'
      : 'Mode: general coaching. Use inventorySuggestions only if clearly useful.'

  const userPrompt = [
    modeHint,
    '',
    'User question:',
    prompt,
    '',
    'Local Materiel data:',
    context
  ].join('\n')

  const llm = createLLMProvider(provider, {
    apiKey,
    fetchImpl: deps?.fetchImpl
  })

  try {
    const completion = await llm.complete({
      model,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 2500
    })

    let answer = completion.text.trim()
    let inventorySuggestions: AiInventorySuggestion[] = []
    try {
      const parsed = extractJsonObject(completion.text)
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>
        if (typeof obj.answer === 'string' && obj.answer.trim()) {
          answer = obj.answer.trim()
        }
        inventorySuggestions = parseSuggestions(obj.inventorySuggestions)
      }
    } catch {
      // Fall back to raw text if the model skipped JSON.
    }

    // Drop suggestions that do not match a real part id.
    const partIds = new Set(listParts(db).map((p) => p.id))
    inventorySuggestions = inventorySuggestions.filter((s) => partIds.has(s.partId))

    return {
      ok: true,
      answer,
      model,
      inventorySuggestions,
      usage: completion.usage
    }
  } catch (error) {
    return { ok: false, error: mapUnknownError(error, apiKey) }
  }
}

function coercePatch(field: string, value: string): UpdatePartInput | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  switch (field) {
    case 'gunsmith':
    case 'caliber':
    case 'notes':
    case 'model':
    case 'name':
      return { [field]: trimmed }
    case 'muzzleType':
      if (trimmed !== 'Suppressor' && trimmed !== 'Brake') return null
      return { muzzleType: trimmed }
    case 'twistRate':
    case 'barrelLife':
    case 'maintenanceInterval': {
      const n = Number(trimmed)
      if (!Number.isFinite(n) || n < 0) return null
      return { [field]: n }
    }
    default:
      return null
  }
}

export function applyInventorySuggestion(
  db: Database.Database,
  input: AiApplyInventorySuggestionInput
): { ok: true } | { ok: false; error: string } {
  const partId = typeof input?.partId === 'string' ? input.partId.trim() : ''
  const field = typeof input?.field === 'string' ? input.field.trim() : ''
  const value = typeof input?.value === 'string' ? input.value : ''
  if (!partId || !ALLOWED_FIELDS.has(field)) {
    return { ok: false, error: 'Invalid inventory suggestion.' }
  }
  const patch = coercePatch(field, value)
  if (!patch) {
    return { ok: false, error: 'Could not apply that suggested value.' }
  }
  try {
    updatePart(db, partId, patch)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Update failed.'
    }
  }
}
