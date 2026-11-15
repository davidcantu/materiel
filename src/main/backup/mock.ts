import type { BackupProvider } from './types'

/** Dev-only mock cloud — no network, no OAuth. */
export const mockBackupProvider: BackupProvider = {
  id: 'mock',
  label: 'Mock Cloud',
  async isAuthenticated() {
    return true
  },
  async authenticate() {
    console.info('[backup:mock] authenticate skipped')
  },
  async uploadEncryptedBackup(localPath: string) {
    console.info('[backup:mock] upload stub:', localPath)
  },
  async downloadLatestBackup(destPath: string) {
    console.info('[backup:mock] download stub:', destPath)
  }
}
