import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppInfo, DatabaseHealthInfo } from '../shared/app-info'
import type {
  BackupLogInfo,
  BackupRunResultInfo,
  BackupSettingsInfo,
  BackupSettingsPatchInfo,
  BackupStatusInfo
} from '../shared/backup'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getAppInfo: () => Promise<AppInfo>
      getDatabaseHealth: () => Promise<DatabaseHealthInfo>
      getBackupSettings: () => Promise<BackupSettingsInfo>
      setBackupSettings: (patch: BackupSettingsPatchInfo) => Promise<BackupSettingsInfo>
      runBackupNow: () => Promise<BackupRunResultInfo>
      listBackupLogs: (limit?: number) => Promise<BackupLogInfo[]>
      getBackupStatus: () => Promise<BackupStatusInfo>
      authenticateBackup: () => Promise<BackupStatusInfo>
      disconnectBackup: () => Promise<BackupStatusInfo>
    }
  }
}

export {}
