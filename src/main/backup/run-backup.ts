/**
 * Orchestrate one backup: snapshot encrypted DB → upload → BackupLog + settings.
 */

import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import {
  buildBackupFileName,
  countBackupRecords,
  formatFileSize,
  getBackupSettings,
  insertBackupLog,
  updateBackupSettings
} from '../db/backup'
import { getDatabase, getDatabasePath, requireDatabase } from '../db'
import type { BackupProvider, BackupRunResult, BackupTrigger } from './types'

function stagingDir(): string {
  const dir = join(app.getPath('temp'), 'materiel-backup-staging')
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Prefer a consistent file copy of the already-encrypted DB.
 * Checkpoint WAL first when possible so the copy is complete.
 */
function createEncryptedSnapshot(fileName: string): { path: string; bytes: number } {
  const handle = getDatabase()
  const sourcePath = handle?.path ?? getDatabasePath()
  if (!existsSync(sourcePath)) {
    throw new Error(`Database file not found at ${sourcePath}`)
  }

  if (handle?.db) {
    try {
      handle.db.pragma('wal_checkpoint(TRUNCATE)')
    } catch (error) {
      console.warn('[backup] wal_checkpoint failed, continuing with file copy', error)
    }
  }

  const dest = join(stagingDir(), fileName)
  copyFileSync(sourcePath, dest)
  const bytes = statSync(dest).size
  return { path: dest, bytes }
}

export async function runBackupOnce(
  provider: BackupProvider,
  trigger: BackupTrigger
): Promise<BackupRunResult> {
  const fileName = buildBackupFileName()
  let stagingPath: string | null = null

  try {
    // Ensure settings row exists before we mutate it.
    getBackupSettings()
    const snapshot = createEncryptedSnapshot(fileName)
    stagingPath = snapshot.path

    if (!(await provider.isAuthenticated())) {
      if (provider.id === 'mock') {
        await provider.authenticate()
      } else {
        throw new Error(`${provider.label} is not authenticated`)
      }
    }

    const upload = await provider.uploadEncryptedBackup(stagingPath, fileName)
    const recordCount = countBackupRecords(requireDatabase().db)
    const fileSize = formatFileSize(upload.bytes || snapshot.bytes)
    const now = new Date().toISOString()

    const log = insertBackupLog({
      timestamp: now,
      type: 'Full',
      status: 'Success',
      fileName,
      fileSize,
      recordCount,
      localPath: upload.remotePath ?? stagingPath
    })

    updateBackupSettings({
      lastBackupTime: now,
      provider: provider.id
    })

    console.info(`[backup] ${trigger} ok via ${provider.id}: ${fileName} (${fileSize})`)

    return {
      ok: true,
      trigger,
      providerId: provider.id,
      fileName,
      fileSize,
      logId: log.id
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[backup] ${trigger} failed:`, message)

    let logId = ''
    try {
      const log = insertBackupLog({
        type: 'Full',
        status: 'Failed',
        fileName,
        fileSize: '',
        recordCount: {},
        errorMessage: message
      })
      logId = log.id
    } catch (logError) {
      console.warn('[backup] failed to write BackupLog', logError)
    }

    return {
      ok: false,
      trigger,
      providerId: provider.id,
      fileName,
      fileSize: '',
      logId,
      errorMessage: message
    }
  } finally {
    if (stagingPath && existsSync(stagingPath)) {
      try {
        rmSync(stagingPath, { force: true })
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
