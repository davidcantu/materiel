import {
  DEFAULT_BACKUP_INTERVAL_HOURS,
  ensureBackupSettings,
  updateBackupSettings
} from '../db/backup'
import { registerBackupIpc } from './ipc'
import { getBackupProvider, resolveProviderId } from './providers'
import { registerQuitBackup, startBackupScheduler } from './scheduler'
import type { BackupProvider } from './types'

export type {
  BackupProvider,
  BackupProviderId,
  BackupRunResult,
  BackupStatus,
  BackupTrigger,
  BackupUploadResult
} from './types'
export { getBackupProvider, resolveProviderId } from './providers'
export { triggerBackupNow } from './scheduler'
export { runBackupOnce } from './run-backup'

/**
 * Wire settings, IPC, hourly scheduler, and quit backup.
 * `npm run dev` defaults to the mock provider.
 */
export function initBackupSubsystem(): BackupProvider {
  const envProvider = resolveProviderId()
  const settings = ensureBackupSettings({
    provider: envProvider,
    intervalHours: DEFAULT_BACKUP_INTERVAL_HOURS
  })

  // Prefer persisted provider when set; otherwise env (mock in development).
  const providerId = resolveProviderId(settings.provider, envProvider)
  if (settings.provider !== providerId) {
    updateBackupSettings({ provider: providerId })
  }

  const provider = getBackupProvider(providerId)
  registerBackupIpc()
  startBackupScheduler(provider)
  registerQuitBackup()
  return provider
}
