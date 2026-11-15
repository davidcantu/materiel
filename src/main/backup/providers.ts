import { mockBackupProvider } from './mock'
import { googleDriveBackupProvider } from './google-drive'
import { oneDriveBackupProvider } from './onedrive'
import type { BackupProvider, BackupProviderId } from './types'

export function resolveProviderId(
  preferred?: string | null,
  envFallback = process.env.MAIN_VITE_BACKUP_PROVIDER ?? 'mock'
): BackupProviderId {
  const candidate = preferred || envFallback
  if (candidate === 'google-drive' || candidate === 'onedrive' || candidate === 'mock') {
    return candidate
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
