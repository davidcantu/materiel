import { ipcMain } from 'electron'
import {
  getBackupSettings,
  listRecentBackupLogs,
  updateBackupSettings,
  type BackupSettingsPatch
} from '../db/backup'
import { getBackupProvider, resolveProviderId } from './providers'
import {
  getActiveBackupProvider,
  setActiveBackupProvider,
  startBackupScheduler,
  triggerBackupNow
} from './scheduler'
import type { BackupStatus } from './types'

async function buildStatus(): Promise<BackupStatus> {
  const provider = getActiveBackupProvider() ?? getBackupProvider()
  const settings = getBackupSettings()
  return {
    providerId: provider.id,
    providerLabel: provider.label,
    configured: provider.isConfigured(),
    authenticated: await provider.isAuthenticated(),
    settings: {
      autoBackupEnabled: settings.autoBackupEnabled,
      backupIntervalHours: settings.backupIntervalHours,
      provider: settings.provider,
      lastBackupTime: settings.lastBackupTime,
      nextBackupTime: settings.nextBackupTime,
      updatedAt: settings.updatedAt
    }
  }
}

export function registerBackupIpc(): void {
  ipcMain.handle('backup:get-settings', () => getBackupSettings())

  ipcMain.handle('backup:set-settings', async (_event, patch: BackupSettingsPatch) => {
    const updated = updateBackupSettings(patch ?? {})

    if (patch?.provider) {
      const next = getBackupProvider(patch.provider)
      setActiveBackupProvider(next)
      startBackupScheduler(next)
    } else if (patch?.backupIntervalHours !== undefined || patch?.autoBackupEnabled !== undefined) {
      const active = getActiveBackupProvider()
      if (active) startBackupScheduler(active)
    }

    return updated
  })

  ipcMain.handle('backup:run-now', async () => triggerBackupNow())

  ipcMain.handle('backup:list-logs', (_event, limit?: number) =>
    listRecentBackupLogs(typeof limit === 'number' ? limit : 20)
  )

  ipcMain.handle('backup:get-status', async () => buildStatus())

  ipcMain.handle('backup:authenticate', async () => {
    const provider = getActiveBackupProvider() ?? getBackupProvider(resolveProviderId())
    await provider.authenticate()
    return buildStatus()
  })

  ipcMain.handle('backup:disconnect', async () => {
    const provider = getActiveBackupProvider() ?? getBackupProvider()
    await provider.disconnect()
    return buildStatus()
  })
}
