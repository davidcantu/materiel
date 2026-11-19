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
    case 403:
      return `${label} rejected the API key (HTTP ${error.status}). Check the key and try again.`
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
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|network|offline|timed out|AbortError/i.test(msg)) {
      return 'Could not reach the provider (offline or timed out). Check your network and try again.'
    }
    return msg || 'Unknown error'
  }
  return redactSecrets(String(error), knownKey)
}
