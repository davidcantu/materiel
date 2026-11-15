import { app, BrowserWindow } from 'electron'
import type { UpdateCheckResult } from '../../shared/updates'
import { checkForUpdate } from './check'
import { promptUpdateAvailable } from './prompt'

export { checkForUpdate, evaluateLatestRelease, RELEASES_LATEST_URL } from './check'
export { isNewerVersion, normalizeVersion, parseVersionCore } from './compare'
export { promptUpdateAvailable } from './prompt'

/** Delay after ready so the main window can show before any dialog. */
export const UPDATE_CHECK_LAUNCH_DELAY_MS = 4_000

/** Periodic re-check while the app stays open (soft; skipped offline). */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

type UpdateCheckerState = {
  promptedVersions: Set<string>
  timer: ReturnType<typeof setInterval> | null
  running: boolean
}

const state: UpdateCheckerState = {
  promptedVersions: new Set(),
  timer: null,
  running: false
}

function resolveCurrentVersion(override?: string): string {
  if (override) return override
  try {
    return app.getVersion()
  } catch {
    return '0.0.0'
  }
}

function preferredParent(): BrowserWindow | null {
  return (
    BrowserWindow.getFocusedWindow() ??
    BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ??
    null
  )
}

/**
 * Run one check; prompt at most once per latest version per process.
 * Soft-fails: never throws, never blocks quit.
 */
export async function runUpdateCheck(options?: {
  currentVersion?: string
  silent?: boolean
}): Promise<UpdateCheckResult> {
  if (state.running) {
    return { status: 'skipped', reason: 'error', detail: 'check in progress' }
  }

  state.running = true
  try {
    const currentVersion = resolveCurrentVersion(options?.currentVersion)
    const result = await checkForUpdate(currentVersion)

    if (result.status !== 'available') {
      if (result.status === 'skipped') {
        console.info('[updates] check skipped:', result.reason, result.detail ?? '')
      }
      return result
    }

    if (options?.silent) {
      return result
    }

    if (state.promptedVersions.has(result.latestVersion)) {
      return result
    }

    state.promptedVersions.add(result.latestVersion)
    await promptUpdateAvailable(result, { parent: preferredParent() })
    return result
  } catch (error) {
    console.warn('[updates] unexpected check failure:', error)
    return {
      status: 'skipped',
      reason: 'error',
      detail: error instanceof Error ? error.message : String(error)
    }
  } finally {
    state.running = false
  }
}

export type InitUpdateCheckerOptions = {
  /** Override launch delay (tests). */
  launchDelayMs?: number
  /** Override periodic interval; `0` disables the interval. */
  intervalMs?: number
  /** Injected for tests. */
  runCheck?: typeof runUpdateCheck
  /** Skip scheduling (tests). */
  schedule?: boolean
}

/**
 * On launch (after a short delay) and optionally every 24h, check GitHub Releases.
 * Safe to call once from app.whenReady after createWindow().
 */
export function initUpdateChecker(options?: InitUpdateCheckerOptions): void {
  const launchDelayMs = options?.launchDelayMs ?? UPDATE_CHECK_LAUNCH_DELAY_MS
  const intervalMs = options?.intervalMs ?? UPDATE_CHECK_INTERVAL_MS
  const runCheck = options?.runCheck ?? runUpdateCheck
  const schedule = options?.schedule !== false

  const kick = (): void => {
    void runCheck().catch((error) => {
      console.warn('[updates] launch check failed:', error)
    })
  }

  if (!schedule) {
    kick()
    return
  }

  setTimeout(kick, launchDelayMs)

  if (intervalMs > 0) {
    if (state.timer) {
      clearInterval(state.timer)
    }
    state.timer = setInterval(() => {
      void runCheck().catch((error) => {
        console.warn('[updates] periodic check failed:', error)
      })
    }, intervalMs)
    // Do not keep the process alive solely for the interval.
    if (typeof state.timer === 'object' && 'unref' in state.timer) {
      state.timer.unref()
    }
  }
}

/** Test helper: clear in-session prompt dedupe / timer. */
export function resetUpdateCheckerStateForTests(): void {
  if (state.timer) {
    clearInterval(state.timer)
    state.timer = null
  }
  state.promptedVersions.clear()
  state.running = false
}
