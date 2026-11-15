export type BackupProviderId = 'mock' | 'google-drive' | 'onedrive'

export type BackupTrigger = 'hourly' | 'quit' | 'manual'

export type BackupUploadResult = {
  bytes: number
  remoteId?: string
  remotePath?: string
}

export type BackupProvider = {
  id: BackupProviderId
  label: string
  /** False when OAuth client IDs are missing (real providers only). */
  isConfigured(): boolean
  isAuthenticated(): Promise<boolean>
  authenticate(): Promise<void>
  disconnect(): Promise<void>
  uploadEncryptedBackup(localPath: string, fileName: string): Promise<BackupUploadResult>
  downloadLatestBackup(destPath: string): Promise<void>
}

export type BackupRunResult = {
  ok: boolean
  trigger: BackupTrigger
  providerId: BackupProviderId
  fileName: string
  fileSize: string
  logId: string
  errorMessage?: string
}

export type BackupStatus = {
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
