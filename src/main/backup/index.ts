import { mockBackupProvider } from './mock'
import { googleDriveBackupProvider } from './google-drive'
import { oneDriveBackupProvider } from './onedrive'
import { registerQuitBackup, startBackupScheduler } from './scheduler'
import type { BackupProvider, BackupProviderId } from './types'

export type { BackupProvider, BackupProviderId }

function resolveProviderId(): BackupProviderId {
  const fromEnv = (process.env.MAIN_VITE_BACKUP_PROVIDER ?? 'mock') as BackupProviderId
  if (fromEnv === 'google-drive' || fromEnv === 'onedrive' || fromEnv === 'mock') {
    return fromEnv
  }
  return 'mock'
}

export function getBackupProvider(id: BackupProviderId = resolveProviderId()): BackupProvider {
  switch (id) {
    case 'google-drive':
      return googleDriveBackupProvider
    case 'onedrive':
      return oneDriveBackupProvider
    case 'mock':
    default:
      return mockBackupProvider
  }
}

/** Wire hourly + quit backup hooks (providers remain stubs until OAuth lands). */
export function initBackupSubsystem(): BackupProvider {
  const provider = getBackupProvider()
  startBackupScheduler(provider)
  registerQuitBackup()
  return provider
}
