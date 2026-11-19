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
import type {
  AiListModelsResult,
  AiProviderId,
  AiSaveKeyInput,
  AiSetModelInput,
  AiStatusInfo,
  AiTestConnectionResult
} from '../shared/ai'

declare global {
  interface Window {
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
      getProfile: () => Promise<ProfileInfo>
      updateProfile: (patch: ProfilePatch) => Promise<ProfileInfo>
      listParts: (filter?: PartsListFilter) => Promise<PartInfo[]>
      getPart: (id: string) => Promise<PartInfo | null>
      createPart: (input: PartInput) => Promise<PartInfo>
      updatePart: (id: string, patch: PartUpdateInput) => Promise<PartInfo>
      deletePart: (id: string) => Promise<{ ok: true }>
      setPartStatus: (
        id: string,
        status: PartStatus,
        options?: { soldToNote?: string | null }
      ) => Promise<PartInfo>
      resetPartMaintenance: (id: string) => Promise<PartInfo>
      countSystems: () => Promise<number>
      listSystems: () => Promise<CompleteSystemInfo[]>
      getSystem: (id: string) => Promise<CompleteSystemInfo | null>
      createCustomSystem: (input: CustomSystemInputInfo) => Promise<CompleteSystemInfo>
      createFactorySystem: (input: FactorySystemInputInfo) => Promise<CompleteSystemInfo>
      updateSystem: (
        id: string,
        patch: Partial<CustomSystemInputInfo & FactorySystemInputInfo> & {
          buildType?: 'custom' | 'factory'
        }
      ) => Promise<CompleteSystemInfo>
      deleteSystem: (id: string) => Promise<{ ok: true; retainedLogCount: number }>
      listLogs: () => Promise<ShootingLogInfo[]>
      getLog: (id: string) => Promise<ShootingLogInfo | null>
      addLog: (input: NewShootingLogInputInfo) => Promise<ShootingLogInfo>
      updateLog: (input: UpdateShootingLogInputInfo) => Promise<ShootingLogInfo>
      deleteLog: (id: string) => Promise<{ ok: true }>
      listAmmo: () => Promise<AmmoInventoryInfo[]>
      getAmmo: (id: string) => Promise<AmmoInventoryInfo | null>
      createAmmo: (input: AmmoInput) => Promise<AmmoInventoryInfo>
      updateAmmo: (id: string, patch: AmmoUpdateInput) => Promise<AmmoInventoryInfo>
      deleteAmmo: (id: string) => Promise<{ ok: true }>
      moveAmmoToPractice: (id: string) => Promise<AmmoInventoryInfo>
      listLoads: () => Promise<LoadDevelopmentInfo[]>
      getLoad: (id: string) => Promise<LoadDevelopmentInfo | null>
      createLoad: (input: LoadInput) => Promise<LoadDevelopmentInfo>
      updateLoad: (id: string, patch: LoadUpdateInput) => Promise<LoadDevelopmentInfo>
      deleteLoad: (id: string) => Promise<{ ok: true }>
      getDashboard: () => Promise<DashboardSummary>
      getMilestones: () => Promise<MilestonesSummary>
      checkForUpdates: () => Promise<UpdateCheckResult>
      importFromJson: (document: MaterielImportDocument) => Promise<MaterielImportResult>
      importPickJsonFile: () => Promise<MaterielImportResult>
      exportExcel: () => Promise<MaterielExportResult>
      getAiStatus: (payload?: {
        provider?: AiProviderId
        rememberProvider?: boolean
      }) => Promise<AiStatusInfo>
      saveAiKey: (input: AiSaveKeyInput) => Promise<AiStatusInfo>
      removeAiKey: (payload?: { provider?: AiProviderId }) => Promise<AiStatusInfo>
      listAiModels: (payload?: { provider?: AiProviderId }) => Promise<AiListModelsResult>
      testAiConnection: (payload?: { provider?: AiProviderId }) => Promise<AiTestConnectionResult>
      setAiModel: (input: AiSetModelInput) => Promise<AiStatusInfo>
    }
  }
}

export {}
