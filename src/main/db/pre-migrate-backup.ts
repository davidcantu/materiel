/**
 * Copy the encrypted DB (+ key blobs) to a timestamped folder beside userData
 * before applying migrations. Never deletes or moves the live files.
 */

import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { basename, dirname, join } from 'path'
import { getDefaultKeyFilePath } from './key'

export type PreMigrateBackupResult = {
  /** Absolute path to the backup directory (sibling of userData). */
  backupDir: string
  /** Basenames copied into backupDir. */
  copiedFiles: string[]
}

/** Filename-safe UTC stamp, e.g. 2026-11-17T01-02-03-456Z */
export function formatBackupTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace(/:/g, '-').replace(/\./g, '-')
}

/**
 * `{parentOfUserData}/{userDataBasename}-db-backup-{stamp}`
 * For the default app path this sits beside Electron userData.
 */
export function resolvePreMigrateBackupDir(dbPath: string, timestamp: string): string {
  const userDataDir = dirname(dbPath)
  const parentDir = dirname(userDataDir)
  return join(parentDir, `${basename(userDataDir)}-db-backup-${timestamp}`)
}

/**
 * If `dbPath` exists, copy it and any sibling key files into a new backup dir.
 * Returns null when there is nothing to back up (first launch).
 */
export function backupDatabaseBeforeMigrate(
  dbPath: string,
  options: { now?: Date; timestamp?: string } = {}
): PreMigrateBackupResult | null {
  if (!existsSync(dbPath)) {
    return null
  }

  const timestamp = options.timestamp ?? formatBackupTimestamp(options.now ?? new Date())
  const backupDir = resolvePreMigrateBackupDir(dbPath, timestamp)
  mkdirSync(backupDir, { recursive: true })

  const copiedFiles: string[] = []

  const copyIfPresent = (sourcePath: string): void => {
    if (!existsSync(sourcePath)) return
    const name = basename(sourcePath)
    copyFileSync(sourcePath, join(backupDir, name))
    copiedFiles.push(name)
  }

  copyIfPresent(dbPath)

  const keyPath = getDefaultKeyFilePath(dbPath)
  copyIfPresent(keyPath)
  copyIfPresent(`${keyPath}.dev`)

  return { backupDir, copiedFiles }
}
