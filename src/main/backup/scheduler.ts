import { app } from 'electron'
import type { BackupProvider } from './types'
import { getDatabasePath } from '../db'

const HOUR_MS = 60 * 60 * 1000

let intervalId: NodeJS.Timeout | null = null
let provider: BackupProvider | null = null
let quitHookRegistered = false

async function runBackup(reason: 'hourly' | 'quit'): Promise<void> {
  if (!provider) return
  try {
    const path = getDatabasePath()
    // TODO: encrypt-then-upload real DB export; await briefly on quit
    await provider.uploadEncryptedBackup(path)
    console.info(`[backup] ${reason} stub completed via ${provider.id}`)
  } catch (error) {
    console.error(`[backup] ${reason} failed:`, error)
  }
}

/** Start hourly backup while the app is open. */
export function startBackupScheduler(activeProvider: BackupProvider): void {
  provider = activeProvider
  stopBackupScheduler()
  intervalId = setInterval(() => {
    void runBackup('hourly')
  }, HOUR_MS)
  console.info(`[backup] hourly scheduler started (${activeProvider.id})`)
}

export function stopBackupScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

/** Register before-quit hook for a final backup attempt. */
export function registerQuitBackup(): void {
  if (quitHookRegistered) return
  quitHookRegistered = true
  app.on('before-quit', () => {
    stopBackupScheduler()
    // Stub: fire-and-forget. Follow-up should flush synchronously or delay quit.
    void runBackup('quit')
  })
}
