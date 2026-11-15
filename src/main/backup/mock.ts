/**
 * Dev mock cloud — copies the encrypted DB into userData/mock-cloud.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { BackupProvider, BackupUploadResult } from './types'

function mockRoot(): string {
  const dir = join(app.getPath('userData'), 'mock-cloud')
  mkdirSync(dir, { recursive: true })
  return dir
}

export const mockBackupProvider: BackupProvider = {
  id: 'mock',
  label: 'Mock Cloud',

  isConfigured() {
    return true
  },

  async isAuthenticated() {
    return true
  },

  async authenticate() {
    console.info('[backup:mock] authenticate skipped (always ready)')
  },

  async disconnect() {
    console.info('[backup:mock] disconnect noop')
  },

  async uploadEncryptedBackup(localPath: string, fileName: string): Promise<BackupUploadResult> {
    if (!existsSync(localPath)) {
      throw new Error(`Backup source missing: ${localPath}`)
    }
    const dest = join(mockRoot(), fileName)
    copyFileSync(localPath, dest)
    const bytes = statSync(dest).size
    console.info(`[backup:mock] uploaded ${fileName} (${bytes} bytes) → ${dest}`)
    return { bytes, remotePath: dest }
  },

  async downloadLatestBackup(destPath: string) {
    const root = mockRoot()
    const files = readdirSync(root)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const full = join(root, f)
        return { full, mtime: statSync(full).mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)

    if (files.length === 0) {
      throw new Error('No mock backups available')
    }
    copyFileSync(files[0].full, destPath)
    console.info(`[backup:mock] downloaded ${files[0].full} → ${destPath}`)
  }
}
