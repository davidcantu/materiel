/**
 * Orchestrate one backup: snapshot encrypted DB → upload → BackupLog + settings.
 * AAR attachment files under userData/aar-attachments are packaged alongside (AI keys excluded).
 */

import { execFileSync } from 'child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
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

function aarAttachmentsDir(): string {
  return join(app.getPath('userData'), 'aar-attachments')
}

/** Tar aar-attachments for cloud upload; returns path or null when empty / unavailable. */
function packageAarAttachments(baseFileName: string): { path: string; bytes: number } | null {
  const attachments = aarAttachmentsDir()
  if (!existsSync(attachments)) return null
  const entries = readdirSync(attachments)
  if (entries.length === 0) return null

  const tarName = baseFileName.replace(/\.db$/i, '') + '.aar-attachments.tar'
  const tarPath = join(stagingDir(), tarName)
  try {
    execFileSync('tar', ['-cf', tarPath, '-C', app.getPath('userData'), 'aar-attachments'], {
      stdio: 'ignore'
    })
  } catch (error) {
    console.warn('[backup] failed to package aar-attachments (DB backup still proceeds)', error)
    return null
  }
  if (!existsSync(tarPath)) return null
  return { path: tarPath, bytes: statSync(tarPath).size }
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

    let attachmentsBytes = 0
    const attachmentsPack = packageAarAttachments(fileName)
    if (attachmentsPack) {
      try {
        const attUpload = await provider.uploadEncryptedBackup(
          attachmentsPack.path,
          attachmentsPack.path.split(/[/\\]/).pop() ?? attachmentsPack.path
        )
        attachmentsBytes = attUpload.bytes || attachmentsPack.bytes
        console.info(
          `[backup] uploaded AAR attachments package (${formatFileSize(attachmentsBytes)})`
        )
      } finally {
        if (existsSync(attachmentsPack.path)) {
          try {
            rmSync(attachmentsPack.path, { force: true })
          } catch {
            // ignore
          }
        }
      }
    }

    const recordCount = countBackupRecords(requireDatabase().db)
    const totalBytes = (upload.bytes || snapshot.bytes) + attachmentsBytes
    const fileSize = formatFileSize(totalBytes)
    const now = new Date().toISOString()

    const log = insertBackupLog({
      timestamp: now,
      type: 'Full',
      status: 'Success',
      fileName: attachmentsBytes > 0 ? `${fileName} (+aar-attachments)` : fileName,
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
