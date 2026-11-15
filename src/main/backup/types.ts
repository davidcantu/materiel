export type BackupProviderId = 'mock' | 'google-drive' | 'onedrive'

export type BackupProvider = {
  id: BackupProviderId
  label: string
  /** TODO: real OAuth + upload/download */
  isAuthenticated(): Promise<boolean>
  authenticate(): Promise<void>
  uploadEncryptedBackup(localPath: string): Promise<void>
  downloadLatestBackup(destPath: string): Promise<void>
}
