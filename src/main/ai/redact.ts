/**
 * Redact API keys and common secret patterns from logs / error strings.
 */

const KEY_LIKE =
  /\b(sk-[A-Za-z0-9_-]{8,}|sk-ant-[A-Za-z0-9_-]{8,}|xai-[A-Za-z0-9_-]{8,}|gsk_[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._\-]+)\b/gi

const LONG_TOKEN = /\b[A-Za-z0-9_\-]{32,}\b/g

/** Mask all but the last `keep` characters of a secret string. */
export function maskSecret(value: string, keep = 4): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.length <= keep) return '•'.repeat(trimmed.length)
  return `${'•'.repeat(Math.min(12, trimmed.length - keep))}${trimmed.slice(-keep)}`
}

/** Last N characters for UI status (never the full key). */
export function keySuffix(value: string, keep = 4): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.slice(-Math.min(keep, trimmed.length))
}

/**
 * Scrub key-like substrings from an arbitrary message.
 * Also redacts an explicit known key when provided.
 */
export function redactSecrets(message: string, knownKey?: string | null): string {
  let out = message
  if (knownKey && knownKey.length > 0) {
    out = out.split(knownKey).join(maskSecret(knownKey))
  }
  out = out.replace(KEY_LIKE, (match) => maskSecret(match.replace(/^Bearer\s+/i, '')))
  // Conservative: long opaque tokens that look like keys
  out = out.replace(LONG_TOKEN, (match) => {
    if (/^[0-9a-f]{32,}$/i.test(match) || /^[A-Za-z0-9_\-]{40,}$/.test(match)) {
      return maskSecret(match)
    }
    return match
  })
  return out
}
