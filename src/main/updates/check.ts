import {
  MATERIEL_DOWNLOAD_URL,
  MATERIEL_GITHUB_OWNER,
  MATERIEL_GITHUB_REPO
} from '../../shared/config'
import type { UpdateCheckResult } from '../../shared/updates'
import { isNewerVersion, normalizeVersion } from './compare'

export const GITHUB_OWNER = MATERIEL_GITHUB_OWNER
export const GITHUB_REPO = MATERIEL_GITHUB_REPO
export const RELEASES_LATEST_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`

/** Default request timeout — soft-fail if GitHub is slow or unreachable. */
export const UPDATE_CHECK_TIMEOUT_MS = 8_000

type GithubReleaseLatest = {
  tag_name?: unknown
  html_url?: unknown
  name?: unknown
  draft?: unknown
  prerelease?: unknown
}

export type FetchLatestRelease = (url: string, init: RequestInit) => Promise<Response>

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Parse GitHub's /releases/latest JSON into an update result vs `currentVersion`.
 * Exported for unit tests (no network).
 */
export function evaluateLatestRelease(currentVersion: string, payload: unknown): UpdateCheckResult {
  if (!payload || typeof payload !== 'object') {
    return { status: 'skipped', reason: 'invalid', detail: 'non-object body' }
  }

  const release = payload as GithubReleaseLatest
  if (release.draft === true) {
    return { status: 'skipped', reason: 'no-release', detail: 'draft' }
  }

  const tag = asNonEmptyString(release.tag_name)
  if (!tag) {
    return { status: 'skipped', reason: 'invalid', detail: 'missing tag_name' }
  }

  const latestVersion = normalizeVersion(tag)
  const current = normalizeVersion(currentVersion)
  const releaseUrl = asNonEmptyString(release.html_url) ?? `${MATERIEL_DOWNLOAD_URL}/tag/${tag}`
  const releaseName = asNonEmptyString(release.name)

  if (!isNewerVersion(latestVersion, current)) {
    return {
      status: 'up-to-date',
      currentVersion: current,
      latestVersion
    }
  }

  return {
    status: 'available',
    currentVersion: current,
    latestVersion,
    releaseUrl,
    releaseName
  }
}

/**
 * Hit GitHub Releases latest API and compare to the running app version.
 * Soft-fails on network / HTTP / parse errors (never throws to callers).
 */
export async function checkForUpdate(
  currentVersion: string,
  options?: {
    fetchImpl?: FetchLatestRelease
    timeoutMs?: number
    url?: string
  }
): Promise<UpdateCheckResult> {
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const timeoutMs = options?.timeoutMs ?? UPDATE_CHECK_TIMEOUT_MS
  const url = options?.url ?? RELEASES_LATEST_URL

  if (typeof fetchImpl !== 'function') {
    return { status: 'skipped', reason: 'error', detail: 'fetch unavailable' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Materiel-UpdateCheck',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })

    if (response.status === 404) {
      return { status: 'skipped', reason: 'no-release' }
    }

    if (!response.ok) {
      return {
        status: 'skipped',
        reason: 'error',
        detail: `HTTP ${response.status}`
      }
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      return { status: 'skipped', reason: 'invalid', detail: 'bad JSON' }
    }

    return evaluateLatestRelease(currentVersion, payload)
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    const message = error instanceof Error ? error.message : String(error)
    const offline =
      name === 'AbortError' ||
      /fetch failed|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|offline/i.test(message)
    return {
      status: 'skipped',
      reason: offline ? 'offline' : 'error',
      detail: message
    }
  } finally {
    clearTimeout(timer)
  }
}
