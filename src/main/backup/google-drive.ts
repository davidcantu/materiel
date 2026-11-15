import type { BackupProvider } from './types'

/**
 * Google Drive backup provider (stub).
 *
 * TODO:
 * - OAuth 2.0 (loopback / PKCE) for desktop
 * - Store refresh token via safeStorage
 * - Upload/download encrypted SQLite blob to appData folder
 */
export const googleDriveBackupProvider: BackupProvider = {
  id: 'google-drive',
  label: 'Google Drive',
  async isAuthenticated() {
    return false
  },
  async authenticate() {
    throw new Error('Google Drive OAuth not implemented yet')
  },
  async uploadEncryptedBackup(localPath: string) {
    void localPath
    throw new Error('Google Drive upload not implemented yet')
  },
  async downloadLatestBackup(destPath: string) {
    void destPath
    throw new Error('Google Drive download not implemented yet')
  }
}
