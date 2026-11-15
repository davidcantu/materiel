import type { BackupProvider } from './types'

/**
 * OneDrive backup provider (stub).
 *
 * TODO:
 * - Microsoft identity platform OAuth for desktop
 * - Store refresh token via safeStorage
 * - Upload/download encrypted SQLite blob via Graph API
 */
export const oneDriveBackupProvider: BackupProvider = {
  id: 'onedrive',
  label: 'OneDrive',
  async isAuthenticated() {
    return false
  },
  async authenticate() {
    throw new Error('OneDrive OAuth not implemented yet')
  },
  async uploadEncryptedBackup(localPath: string) {
    void localPath
    throw new Error('OneDrive upload not implemented yet')
  },
  async downloadLatestBackup(destPath: string) {
    void destPath
    throw new Error('OneDrive download not implemented yet')
  }
}
