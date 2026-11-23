export type BackupProviderId = 'mock' | 'google-drive' | 'onedrive'

export type BackupSettingsInfo = {
  autoBackupEnabled: boolean
  backupIntervalHours: number
  provider: string | null
  lastBackupTime: string | null
  nextBackupTime: string | null
  updatedAt: string
}

export type BackupLogInfo = {
  id: string
  timestamp: string
  type: 'Full' | 'User'
  targetUserEmail: string | null
  status: 'Success' | 'Failed'
  fileName: string
  fileSize: string
  recordCount: Record<string, number>
  localPath: string | null
  errorMessage: string | null
  createdAt: string
}

export type BackupRunResultInfo = {
  ok: boolean
  trigger: 'hourly' | 'quit' | 'manual'
  providerId: BackupProviderId
  fileName: string
  fileSize: string
  logId: string
  errorMessage?: string
}

export type BackupStatusInfo = {
  providerId: BackupProviderId
  providerLabel: string
  configured: boolean
  authenticated: boolean
  settings: {
    autoBackupEnabled: boolean
    backupIntervalHours: number
    provider: string | null
    lastBackupTime: string | null
    nextBackupTime: string | null
    updatedAt: string
  }
}

export type BackupSettingsPatchInfo = {
  autoBackupEnabled?: boolean
  backupIntervalHours?: number
  provider?: BackupProviderId | null
  lastBackupTime?: string | null
  nextBackupTime?: string | null
}

export type BackupRestoreResult =
  | { ok: true; source: 'file' | 'cloud'; relaunching: true }
  | { ok: false; error: string }
