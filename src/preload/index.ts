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
  disconnectBackup: (): Promise<BackupStatusInfo> => ipcRenderer.invoke('backup:disconnect'),
  getLicenseStatus: (): Promise<LicenseStatusInfo> => ipcRenderer.invoke('license:get-status'),
  activateLicense: (request: LicenseActivateRequest): Promise<LicenseActivateResult> =>
    ipcRenderer.invoke('license:activate', request),
  clearLicense: (): Promise<LicenseStatusInfo> => ipcRenderer.invoke('license:clear'),
  getProfile: (): Promise<ProfileInfo> => ipcRenderer.invoke('profile:get'),
  updateProfile: (patch: ProfilePatch): Promise<ProfileInfo> =>
    ipcRenderer.invoke('profile:update', patch),
  listParts: (filter?: PartsListFilter): Promise<PartInfo[]> =>
    ipcRenderer.invoke('parts:list', filter),
  getPart: (id: string): Promise<PartInfo | null> => ipcRenderer.invoke('parts:get', id),
  createPart: (input: PartInput): Promise<PartInfo> => ipcRenderer.invoke('parts:create', input),
  updatePart: (id: string, patch: PartUpdateInput): Promise<PartInfo> =>
    ipcRenderer.invoke('parts:update', id, patch),
  deletePart: (id: string): Promise<{ ok: true }> => ipcRenderer.invoke('parts:delete', id),
  setPartStatus: (id: string, status: PartStatus): Promise<PartInfo> =>
    ipcRenderer.invoke('parts:set-status', id, status),
  resetPartMaintenance: (id: string): Promise<PartInfo> =>
    ipcRenderer.invoke('parts:reset-maintenance', id),
  countSystems: (): Promise<number> => ipcRenderer.invoke('systems:count'),
  listSystems: (): Promise<CompleteSystemInfo[]> => ipcRenderer.invoke('systems:list'),
  getSystem: (id: string): Promise<CompleteSystemInfo | null> =>
    ipcRenderer.invoke('systems:get', id),
  createCustomSystem: (input: CustomSystemInputInfo): Promise<GatedSystemCreateResult> =>
    ipcRenderer.invoke('systems:create-custom', input),
  createFactorySystem: (input: FactorySystemInputInfo): Promise<GatedSystemCreateResult> =>
    ipcRenderer.invoke('systems:create-factory', input),
  updateSystem: (
    id: string,
    patch: Partial<CustomSystemInputInfo & FactorySystemInputInfo> & {
      buildType?: 'custom' | 'factory'
    }
  ): Promise<CompleteSystemInfo> => ipcRenderer.invoke('systems:update', id, patch),
  deleteSystem: (id: string): Promise<{ ok: true }> => ipcRenderer.invoke('systems:delete', id),
  assertRestoreAllowed: (systemCount: number): Promise<RestoreLicenseCheckResult> =>
    ipcRenderer.invoke('systems:assert-restore-allowed', systemCount)
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
