/**
 * Map provider HTTP / network failures to short, safe UI messages.
 */

import { redactSecrets } from './redact'

export type ProviderHttpError = {
  status: number
  bodyText?: string
  providerLabel?: string
}

function bodySnippet(bodyText: string | undefined, knownKey?: string | null): string {
  if (!bodyText) return ''
  const trimmed = bodyText.replace(/\s+/g, ' ').trim().slice(0, 180)
  return redactSecrets(trimmed, knownKey)
}

/** User-facing error for a failed provider HTTP response (never includes raw keys). */
export function mapProviderHttpError(
  error: ProviderHttpError,
  knownKey?: string | null
): string {
  const label = error.providerLabel ?? 'Provider'
  const snippet = bodySnippet(error.bodyText, knownKey)

  switch (error.status) {
    case 401:
    case 403: {
      const xaiHint =
        /xai|grok/i.test(label) && error.status === 401
          ? ' Use an API key from console.x.ai (not a grok.com chat login, and not a Groq gsk_ key).'
          : ''
      const groqHint =
        /groq/i.test(label) && !/xai|grok/i.test(label) && error.status === 401
          ? ' Groq keys start with gsk_ and come from console.groq.com — they are not xAI/Grok keys.'
          : ''
      return `${label} rejected the API key (HTTP ${error.status}). Check the key and try again.${xaiHint}${groqHint}`
    }
    case 402:
      return `${label} reports a billing problem (HTTP 402). Add credits or fix billing on the provider account.`
    case 404:
      return `${label} endpoint not found (HTTP 404).`
    case 429:
      return `${label} rate-limited the request (HTTP 429). Wait a moment and re-check.`
    default:
      if (error.status >= 500) {
        return `${label} is unavailable (HTTP ${error.status}). Try again later.`
      }
      if (snippet) {
        return `${label} request failed (HTTP ${error.status}): ${snippet}`
      }
      return `${label} request failed (HTTP ${error.status}).`
  }
}

/** Scrub and shorten an unknown thrown value for UI / logs. */
export function mapUnknownError(error: unknown, knownKey?: string | null): string {
  if (error instanceof Error) {
    const msg = redactSecrets(error.message, knownKey)
    if (
      /AbortError/i.test(msg) ||
      /timed out while reasoning|timed out waiting for a completion/i.test(msg)
    ) {
      return msg
    }
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|network|offline|timed out|timeout/i.test(msg)) {
      return 'Could not reach the provider (offline or timed out). Check your network and try again.'
    }
    return msg || 'Unknown error'
  }
  return redactSecrets(String(error), knownKey)
}
