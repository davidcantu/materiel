/**
 * Soft update-check results from GitHub Releases (main process).
 * Failures are skipped so offline / API errors never block the app.
 */

export type UpdateAvailable = {
  status: 'available'
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  releaseName: string | null
}

export type UpdateUpToDate = {
  status: 'up-to-date'
  currentVersion: string
  latestVersion: string
}

export type UpdateSkipped = {
  status: 'skipped'
  reason: 'offline' | 'error' | 'no-release' | 'invalid'
  detail?: string
}

export type UpdateCheckResult = UpdateAvailable | UpdateUpToDate | UpdateSkipped
