/**
 * Materiel AI Assistant (unlocked when a BYOK key is saved).
 */

export type AiAssistantPrompt = {
  id: string
  label: string
  prompt: string
  /** Short chip title shown in the UI. */
  title: string
}

export const AI_ASSISTANT_SAMPLE_PROMPTS: readonly AiAssistantPrompt[] = [
  {
    id: 'training-plan',
    title: 'Next training plan',
    label: 'What should I consider for my next training plan?',
    prompt:
      'Based on my builds, recent practice and match logs, maintenance due, and ammo on hand, what should I consider for my next 2–4 week training plan? Be specific and practical.'
  },
  {
    id: 'inventory-fill',
    title: 'Fill inventory gaps',
    label: 'Help me fill in values for my inventory',
    prompt:
      'Review my inventory for missing or thin fields (gunsmith, barrel life, twist, maintenance interval, cartridge, notes). Suggest concrete fill-ins I can apply. Prefer conservative estimates and call out anything you are guessing.'
  },
  {
    id: 'equipment',
    title: 'Gear that helps',
    label: 'What equipment or tools might help me improve my shooting?',
    prompt:
      'Looking at my current builds, optics, and logs, what equipment or tools might help me improve? Prioritize high-leverage upgrades over shopping lists, and explain why each suggestion fits my setup.'
  },
  {
    id: 'weekend-pick',
    title: 'Which rifle this weekend?',
    label: 'Help me pick which build to shoot this weekend',
    prompt:
      'Compare my complete builds using round counts, maintenance status, and recent match/practice notes. Recommend which one I should shoot this weekend and why.'
  },
  {
    id: 'match-points',
    title: 'Where am I dropping points?',
    label: 'Where am I leaving points on the table?',
    prompt:
      'Using my match placements, percent of winner, and any AAR/PPEWS trends available, where am I likely leaving the most points on the table? Give 3 focused fixes for the next match.'
  },
  {
    id: 'ammo-practice',
    title: 'Practice with on-hand ammo',
    label: 'Design a practice session with ammo I already have',
    prompt:
      'Design one practice session I can run this week using only ammo lots I already have. Include round count, drill focus, and which build to use.'
  },
  {
    id: 'pre-match',
    title: 'Pre-match checklist',
    label: 'What should I clean or replace before my next match?',
    prompt:
      'Given maintenance intervals and barrel wear, what should I clean, reset, or replace before my next match? Order by urgency.'
  },
  {
    id: 'blank-spots',
    title: 'Armory blank spots',
    label: 'What is missing from my armory story?',
    prompt:
      'Looking at my inventory and builds as a whole, what blank spots or inconsistencies stand out (missing chassis, unlabeled barrels, pistols without cartridge, builds without optics)? Suggest a tidy-up checklist.'
  }
] as const

export type AiInventorySuggestion = {
  partId: string
  label: string
  field: string
  currentValue: string | null
  suggestedValue: string
  reason: string
}

export type AiAssistantAskInput = {
  prompt: string
  /** Optional hint so the model leans into inventory suggestions. */
  mode?: 'general' | 'inventory'
}

export type AiAssistantAskResult =
  | {
      ok: true
      answer: string
      model: string
      inventorySuggestions: AiInventorySuggestion[]
      usage?: { inputTokens?: number; outputTokens?: number }
    }
  | { ok: false; error: string }

export type AiApplyInventorySuggestionInput = {
  partId: string
  field: string
  value: string
}
