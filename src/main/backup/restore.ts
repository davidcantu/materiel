/**
 * Replace the live encrypted database from a local file or cloud download, then relaunch.
 */

import { app, dialog } from 'electron'
import { copyFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { BackupRestoreResult } from '../../shared/backup'
import { closeDatabase, getDatabase, getDatabasePath } from '../db'
import { getBackupProvider, resolveProviderId } from './providers'
import { getActiveBackupProvider } from './scheduler'

function backupDir(): string {
  const dir = join(app.getPath('userData'), 'restore-safety')
  mkdirSync(dir, { recursive: true })
  return dir
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function checkpointIfOpen(): void {
  const handle = getDatabase()
  if (!handle?.db) return
  try {
    handle.db.pragma('wal_checkpoint(TRUNCATE)')
  } catch (error) {
    console.warn('[restore] wal_checkpoint failed', error)
  }
}

function swapInDatabase(sourcePath: string): void {
  const livePath = getDatabasePath()
  if (!existsSync(sourcePath)) {
    throw new Error('Restore source file not found')
  }
  checkpointIfOpen()
  closeDatabase()

  const safety = join(backupDir(), `materiel-before-restore-${stamp()}.db`)
  if (existsSync(livePath)) {
    copyFileSync(livePath, safety)
  }

  const tmp = `${livePath}.restore-tmp`
  copyFileSync(sourcePath, tmp)
  try {
    if (existsSync(livePath)) unlinkSync(livePath)
  } catch {
    // Windows may still hold a handle briefly; rename over.
  }
  renameSync(tmp, livePath)

  // Drop WAL/SHM leftovers so the restored main file is authoritative.
  for (const suffix of ['-wal', '-shm']) {
    const side = `${livePath}${suffix}`
    if (existsSync(side)) {
      try {
        unlinkSync(side)
      } catch {
        // ignore
      }
    }
  }
}

function relaunchSoon(): void {
  setTimeout(() => {
    app.relaunch()
    app.exit(0)
  }, 250)
}

export async function restoreFromLocalFile(): Promise<BackupRestoreResult> {
  try {
    const pick = await dialog.showOpenDialog({
      title: 'Restore Materiel database',
      properties: ['openFile'],
      filters: [
        { name: 'Materiel backup / database', extensions: ['db', 'sqlite', 'materiel'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (pick.canceled || pick.filePaths.length === 0) {
      return { ok: false, error: 'Restore cancelled' }
    }
    const confirmed = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Restore & relaunch', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Replace local database?',
      message:
        'This replaces your current Materiel database with the selected file. A safety copy is kept under restore-safety. The app will relaunch.'
    })
    if (confirmed.response !== 0) {
      return { ok: false, error: 'Restore cancelled' }
    }
    swapInDatabase(pick.filePaths[0]!)
    relaunchSoon()
    return { ok: true, source: 'file', relaunching: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Restore failed'
    }
  }
}

export async function restoreFromCloudLatest(): Promise<BackupRestoreResult> {
  try {
    const provider = getActiveBackupProvider() ?? getBackupProvider(resolveProviderId())
    if (!(await provider.isAuthenticated())) {
      return { ok: false, error: `${provider.label} is not connected` }
    }
    const confirmed = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Restore & relaunch', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Restore latest cloud backup?',
      message: `Download the latest backup from ${provider.label} and replace your local database. A safety copy is kept. The app will relaunch.`
    })
    if (confirmed.response !== 0) {
      return { ok: false, error: 'Restore cancelled' }
    }

    const dest = join(backupDir(), `cloud-download-${stamp()}.db`)
    await provider.downloadLatestBackup(dest)
    swapInDatabase(dest)
    relaunchSoon()
    return { ok: true, source: 'cloud', relaunching: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Cloud restore failed'
    }
  }
}
