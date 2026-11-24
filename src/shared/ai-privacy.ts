/**
 * AI data-minimization prefs — defaults favor 2A privacy.
 * Stored in local AI prefs (not secrets).
 */

export type AiPrivacyPrefs = {
  /** Include shooting-log / match locations in prompts. Default: false. */
  includeLocations: boolean
  /** Include free-text notes from parts/logs/AARs. Default: false. */
  includeNotes: boolean
  /** Include manufacturer / model / caliber detail. Default: true (needed for useful answers). */
  includeEquipmentDetail: boolean
  /** Show a confirmation of what will be sent before each AI call. Default: true. */
  confirmBeforeSend: boolean
}

export const DEFAULT_AI_PRIVACY_PREFS: AiPrivacyPrefs = {
  includeLocations: false,
  includeNotes: false,
  includeEquipmentDetail: true,
  confirmBeforeSend: true
}

export function normalizeAiPrivacyPrefs(raw: unknown): AiPrivacyPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AI_PRIVACY_PREFS }
  const obj = raw as Record<string, unknown>
  return {
    includeLocations:
      typeof obj.includeLocations === 'boolean'
        ? obj.includeLocations
        : DEFAULT_AI_PRIVACY_PREFS.includeLocations,
    includeNotes:
      typeof obj.includeNotes === 'boolean'
        ? obj.includeNotes
        : DEFAULT_AI_PRIVACY_PREFS.includeNotes,
    includeEquipmentDetail:
      typeof obj.includeEquipmentDetail === 'boolean'
        ? obj.includeEquipmentDetail
        : DEFAULT_AI_PRIVACY_PREFS.includeEquipmentDetail,
    confirmBeforeSend:
      typeof obj.confirmBeforeSend === 'boolean'
        ? obj.confirmBeforeSend
        : DEFAULT_AI_PRIVACY_PREFS.confirmBeforeSend
  }
}

export const AI_PRIVACY_COPY = {
  lead:
    'AI calls leave this computer and go to your chosen provider (Anthropic, OpenAI, xAI, or Groq). Materiel never hosts your armory data. Defaults strip locations and notes; serial numbers are never sent.',
  confirmTitle: 'Send data to your AI provider?',
  confirmBody:
    'Your question plus a minimized snapshot of local inventory/builds/logs will be sent to the provider API using your key. Serial numbers are never included.'
} as const
