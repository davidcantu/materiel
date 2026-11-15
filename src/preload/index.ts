import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppInfo, DatabaseHealthInfo } from '../shared/app-info'
import type {
  BackupLogInfo,
  BackupRunResultInfo,
  BackupSettingsInfo,
  BackupSettingsPatchInfo,
  BackupStatusInfo
} from '../shared/backup'

const api = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:get-info'),
  getDatabaseHealth: (): Promise<DatabaseHealthInfo> => ipcRenderer.invoke('db:health'),
  getBackupSettings: (): Promise<BackupSettingsInfo> => ipcRenderer.invoke('backup:get-settings'),
  setBackupSettings: (patch: BackupSettingsPatchInfo): Promise<BackupSettingsInfo> =>
    ipcRenderer.invoke('backup:set-settings', patch),
  runBackupNow: (): Promise<BackupRunResultInfo> => ipcRenderer.invoke('backup:run-now'),
  listBackupLogs: (limit?: number): Promise<BackupLogInfo[]> =>
    ipcRenderer.invoke('backup:list-logs', limit),
  getBackupStatus: (): Promise<BackupStatusInfo> => ipcRenderer.invoke('backup:get-status'),
  authenticateBackup: (): Promise<BackupStatusInfo> => ipcRenderer.invoke('backup:authenticate'),
  disconnectBackup: (): Promise<BackupStatusInfo> => ipcRenderer.invoke('backup:disconnect')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
