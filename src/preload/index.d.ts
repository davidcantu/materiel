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
  PartInfo,
  PartInput,
  PartsListFilter,
  PartStatus,
  PartUpdateInput
} from '../shared/parts'
import type { ProfileInfo, ProfilePatch } from '../shared/profile'
import type {
  CompleteSystemInfo,
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
      getProfile: () => Promise<ProfileInfo>
      updateProfile: (patch: ProfilePatch) => Promise<ProfileInfo>
      listParts: (filter?: PartsListFilter) => Promise<PartInfo[]>
      getPart: (id: string) => Promise<PartInfo | null>
      createPart: (input: PartInput) => Promise<PartInfo>
      updatePart: (id: string, patch: PartUpdateInput) => Promise<PartInfo>
      deletePart: (id: string) => Promise<{ ok: true }>
      setPartStatus: (id: string, status: PartStatus) => Promise<PartInfo>
      resetPartMaintenance: (id: string) => Promise<PartInfo>
      countSystems: () => Promise<number>
      listSystems: () => Promise<CompleteSystemInfo[]>
      getSystem: (id: string) => Promise<CompleteSystemInfo | null>
      createCustomSystem: (input: CustomSystemInputInfo) => Promise<GatedSystemCreateResult>
      createFactorySystem: (input: FactorySystemInputInfo) => Promise<GatedSystemCreateResult>
      updateSystem: (
        id: string,
        patch: Partial<CustomSystemInputInfo & FactorySystemInputInfo> & {
          buildType?: 'custom' | 'factory'
        }
      ) => Promise<CompleteSystemInfo>
      deleteSystem: (id: string) => Promise<{ ok: true }>
      assertRestoreAllowed: (systemCount: number) => Promise<RestoreLicenseCheckResult>
    }
  }
}

export {}
