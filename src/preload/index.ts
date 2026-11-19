import { contextBridge, ipcRenderer } from 'electron'
import type { AppInfo, DatabaseHealthInfo } from '../shared/app-info'
import type {
  BackupLogInfo,
  BackupRunResultInfo,
  BackupSettingsInfo,
  BackupSettingsPatchInfo,
  BackupStatusInfo
} from '../shared/backup'
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
  FactorySystemInputInfo
} from '../shared/systems'
import type { AmmoInput, AmmoInventoryInfo, AmmoUpdateInput } from '../shared/ammo'
import type { LoadDevelopmentInfo, LoadInput, LoadUpdateInput } from '../shared/loads'
import type {
  NewShootingLogInputInfo,
  ShootingLogInfo,
  UpdateShootingLogInputInfo
} from '../shared/shooting-logs'
import type { DashboardSummary } from '../shared/dashboard'
import type { MilestonesSummary } from '../shared/milestones'
import type { UpdateCheckResult } from '../shared/updates'
import type { MaterielExportResult } from '../shared/export'
import type { MaterielImportDocument, MaterielImportResult } from '../shared/import'

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
  getProfile: (): Promise<ProfileInfo> => ipcRenderer.invoke('profile:get'),
  updateProfile: (patch: ProfilePatch) => ipcRenderer.invoke('profile:update', patch),
  listParts: (filter?: PartsListFilter): Promise<PartInfo[]> =>
    ipcRenderer.invoke('parts:list', filter),
  getPart: (id: string): Promise<PartInfo | null> => ipcRenderer.invoke('parts:get', id),
  createPart: (input: PartInput): Promise<PartInfo> => ipcRenderer.invoke('parts:create', input),
  updatePart: (id: string, patch: PartUpdateInput): Promise<PartInfo> =>
    ipcRenderer.invoke('parts:update', id, patch),
  deletePart: (id: string): Promise<{ ok: true }> => ipcRenderer.invoke('parts:delete', id),
  setPartStatus: (
    id: string,
    status: PartStatus,
    options?: { soldToNote?: string | null }
  ): Promise<PartInfo> => ipcRenderer.invoke('parts:set-status', id, status, options),
  resetPartMaintenance: (id: string): Promise<PartInfo> =>
    ipcRenderer.invoke('parts:reset-maintenance', id),
  countSystems: (): Promise<number> => ipcRenderer.invoke('systems:count'),
  listSystems: (): Promise<CompleteSystemInfo[]> => ipcRenderer.invoke('systems:list'),
  getSystem: (id: string): Promise<CompleteSystemInfo | null> =>
    ipcRenderer.invoke('systems:get', id),
  createCustomSystem: (input: CustomSystemInputInfo): Promise<CompleteSystemInfo> =>
    ipcRenderer.invoke('systems:create-custom', input),
  createFactorySystem: (input: FactorySystemInputInfo): Promise<CompleteSystemInfo> =>
    ipcRenderer.invoke('systems:create-factory', input),
  updateSystem: (
    id: string,
    patch: Partial<CustomSystemInputInfo & FactorySystemInputInfo> & {
      buildType?: 'custom' | 'factory'
    }
  ): Promise<CompleteSystemInfo> => ipcRenderer.invoke('systems:update', id, patch),
  deleteSystem: (id: string): Promise<{ ok: true; retainedLogCount: number }> =>
    ipcRenderer.invoke('systems:delete', id),
  listLogs: (): Promise<ShootingLogInfo[]> => ipcRenderer.invoke('logs:list'),
  getLog: (id: string): Promise<ShootingLogInfo | null> => ipcRenderer.invoke('logs:get', id),
  addLog: (input: NewShootingLogInputInfo): Promise<ShootingLogInfo> =>
    ipcRenderer.invoke('logs:add', input),
  updateLog: (input: UpdateShootingLogInputInfo): Promise<ShootingLogInfo> =>
    ipcRenderer.invoke('logs:update', input),
  deleteLog: (id: string): Promise<{ ok: true }> => ipcRenderer.invoke('logs:delete', id),
  listAmmo: (): Promise<AmmoInventoryInfo[]> => ipcRenderer.invoke('ammo:list'),
  getAmmo: (id: string): Promise<AmmoInventoryInfo | null> => ipcRenderer.invoke('ammo:get', id),
  createAmmo: (input: AmmoInput): Promise<AmmoInventoryInfo> =>
    ipcRenderer.invoke('ammo:create', input),
  updateAmmo: (id: string, patch: AmmoUpdateInput): Promise<AmmoInventoryInfo> =>
    ipcRenderer.invoke('ammo:update', id, patch),
  deleteAmmo: (id: string): Promise<{ ok: true }> => ipcRenderer.invoke('ammo:delete', id),
  moveAmmoToPractice: (id: string): Promise<AmmoInventoryInfo> =>
    ipcRenderer.invoke('ammo:move-to-practice', id),
  listLoads: (): Promise<LoadDevelopmentInfo[]> => ipcRenderer.invoke('loads:list'),
  getLoad: (id: string): Promise<LoadDevelopmentInfo | null> => ipcRenderer.invoke('loads:get', id),
  createLoad: (input: LoadInput): Promise<LoadDevelopmentInfo> =>
    ipcRenderer.invoke('loads:create', input),
  updateLoad: (id: string, patch: LoadUpdateInput): Promise<LoadDevelopmentInfo> =>
    ipcRenderer.invoke('loads:update', id, patch),
  deleteLoad: (id: string): Promise<{ ok: true }> => ipcRenderer.invoke('loads:delete', id),
  getDashboard: (): Promise<DashboardSummary> => ipcRenderer.invoke('dashboard:get'),
  getMilestones: (): Promise<MilestonesSummary> => ipcRenderer.invoke('milestones:get'),
  checkForUpdates: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('updates:check'),
  importFromJson: (document: MaterielImportDocument): Promise<MaterielImportResult> =>
    ipcRenderer.invoke('import:from-json', document),
  importPickJsonFile: (): Promise<MaterielImportResult> =>
    ipcRenderer.invoke('import:pick-json-file'),
  exportExcel: (): Promise<MaterielExportResult> => ipcRenderer.invoke('export:excel')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.api = api
}
