import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppInfo, DatabaseHealthInfo } from '../shared/app-info'
import type {
  BackupLogInfo,
  BackupRunResultInfo,
  BackupSettingsInfo,
  BackupSettingsPatchInfo,
  BackupStatusInfo
} from '../shared/backup'
import type {
  LicenseActivateRequest,
  LicenseActivateResult,
  LicenseStatusInfo
} from '../shared/license'
import type {
  CustomSystemInputInfo,
  FactorySystemInputInfo,
  GatedSystemCreateResult,
  RestoreLicenseCheckResult
} from '../shared/systems'

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
      getLicenseStatus: () => Promise<LicenseStatusInfo>
      activateLicense: (request: LicenseActivateRequest) => Promise<LicenseActivateResult>
      clearLicense: () => Promise<LicenseStatusInfo>
      countSystems: () => Promise<number>
      createCustomSystem: (input: CustomSystemInputInfo) => Promise<GatedSystemCreateResult>
      createFactorySystem: (input: FactorySystemInputInfo) => Promise<GatedSystemCreateResult>
      assertRestoreAllowed: (systemCount: number) => Promise<RestoreLicenseCheckResult>
    }
  }
}

export {}
