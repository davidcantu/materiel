import { app } from 'electron'
import { getBackupSettings } from '../db/backup'
import { runBackupOnce } from './run-backup'
import type { BackupProvider, BackupRunResult } from './types'

const MINUTE_MS = 60 * 1000
const QUIT_BACKUP_TIMEOUT_MS = 30_000

let provider: BackupProvider | null = null
let tickTimer: NodeJS.Timeout | null = null
let quitHookRegistered = false
let quitBackupStarted = false
let running: Promise<BackupRunResult> | null = null

async function withLock(trigger: 'hourly' | 'quit' | 'manual'): Promise<BackupRunResult | null> {
  if (!provider) {
    return null
  }
  if (running) {
    console.info(`[backup] skip ${trigger}: backup already in progress`)
    return running
  }
  running = runBackupOnce(provider, trigger)
  try {
    return await running
  } finally {
    running = null
  }
}

async function maybeRunScheduled(): Promise<void> {
  if (!provider) return
  try {
    const settings = getBackupSettings()
    if (!settings.autoBackupEnabled) return

    const due = !settings.nextBackupTime || Date.parse(settings.nextBackupTime) <= Date.now()
    if (!due) return

    await withLock('hourly')
  } catch (error) {
    console.error('[backup] scheduled tick failed:', error)
  }
}

/** Start scheduler driven by BackupSettings (default hourly). */
export function startBackupScheduler(activeProvider: BackupProvider): void {
  provider = activeProvider
  stopBackupScheduler()

  // Tick every minute; run when nextBackupTime is due (honors interval hours).
  tickTimer = setInterval(() => {
    void maybeRunScheduled()
  }, MINUTE_MS)

  // Kick once shortly after launch so first backup isn't delayed a full hour in tests/dev.
  setTimeout(() => {
    void maybeRunScheduled()
  }, 5_000)

  const settings = (() => {
    try {
      return getBackupSettings()
    } catch {
      return null
    }
  })()

  console.info(
    `[backup] scheduler started provider=${activeProvider.id} intervalHours=${settings?.backupIntervalHours ?? '?'} auto=${settings?.autoBackupEnabled ?? '?'}`
  )
}

export function stopBackupScheduler(): void {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

export function getActiveBackupProvider(): BackupProvider | null {
  return provider
}

export function setActiveBackupProvider(next: BackupProvider): void {
  provider = next
}

export async function triggerBackupNow(): Promise<BackupRunResult> {
  if (!provider) {
    throw new Error('Backup subsystem is not initialized')
  }
  const result = await withLock('manual')
  if (!result) {
    throw new Error('Backup provider unavailable')
  }
  return result
}

/** Register before-quit hook: delay quit until backup finishes (or times out). */
export function registerQuitBackup(): void {
  if (quitHookRegistered) return
  quitHookRegistered = true

  app.on('before-quit', (event) => {
    if (quitBackupStarted) return
    if (!provider) return

    let settings
    try {
      settings = getBackupSettings()
    } catch {
      return
    }
    if (!settings.autoBackupEnabled) return

    quitBackupStarted = true
    event.preventDefault()
    stopBackupScheduler()

    const timeout = new Promise<void>((resolve) => {
      setTimeout(resolve, QUIT_BACKUP_TIMEOUT_MS)
    })

    void Promise.race([withLock('quit').then(() => undefined), timeout]).finally(() => {
      app.quit()
    })
  })
}
