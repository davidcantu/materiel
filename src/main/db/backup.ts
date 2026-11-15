/**
 * BackupSettings + BackupLog persistence (software-spec §3.7, single-user).
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
import { requireDatabase } from './connection'
import type { BackupLogRecord, BackupLogStatus, BackupLogType, BackupSettings } from './types'

/** Local-first default: hourly while the app is open. Spec web default was 24h. */
export const DEFAULT_BACKUP_INTERVAL_HOURS = 1

export const ALLOWED_BACKUP_INTERVAL_HOURS = [1, 12, 24, 168] as const

export type BackupProviderChoice = 'mock' | 'google-drive' | 'onedrive'

export type BackupSettingsPatch = {
  autoBackupEnabled?: boolean
  backupIntervalHours?: number
  provider?: BackupProviderChoice | null
  lastBackupTime?: string | null
  nextBackupTime?: string | null
}

export type NewBackupLogInput = {
  id?: string
  timestamp?: string
  type?: BackupLogType
  targetUserEmail?: string | null
  status: BackupLogStatus
  fileName: string
  fileSize?: string
  recordCount?: Record<string, number>
  localPath?: string | null
  errorMessage?: string | null
}

type BackupSettingsRow = {
  auto_backup_enabled: number
  backup_interval_hours: number
  provider: string | null
  last_backup_time: string | null
  next_backup_time: string | null
  updated_at: string
}

type BackupLogRow = {
  id: string
  timestamp: string
  type: BackupLogType
  target_user_email: string | null
  status: BackupLogStatus
  file_name: string
  file_size: string
  record_count: string
  local_path: string | null
  error_message: string | null
  created_at: string
}

function mapSettings(row: BackupSettingsRow): BackupSettings {
  return {
    autoBackupEnabled: row.auto_backup_enabled === 1,
    backupIntervalHours: row.backup_interval_hours,
    provider: row.provider,
    lastBackupTime: row.last_backup_time,
    nextBackupTime: row.next_backup_time,
    updatedAt: row.updated_at
  }
}

function mapLog(row: BackupLogRow): BackupLogRecord {
  let recordCount: Record<string, number>
  try {
    recordCount = JSON.parse(row.record_count) as Record<string, number>
  } catch {
    recordCount = {}
  }
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    targetUserEmail: row.target_user_email,
    status: row.status,
    fileName: row.file_name,
    fileSize: row.file_size,
    recordCount,
    localPath: row.local_path,
    errorMessage: row.error_message,
    createdAt: row.created_at
  }
}

function normalizeIntervalHours(hours: number): number {
  if ((ALLOWED_BACKUP_INTERVAL_HOURS as readonly number[]).includes(hours)) {
    return hours
  }
  return DEFAULT_BACKUP_INTERVAL_HOURS
}

function normalizeProvider(provider: string | null | undefined): string | null {
  if (provider === 'mock' || provider === 'google-drive' || provider === 'onedrive') {
    return provider
  }
  return provider ?? null
}

export type EnsureBackupSettingsDefaults = {
  provider?: string | null
  intervalHours?: number
}

function resolveDb(db?: Database.Database): Database.Database {
  return db ?? requireDatabase().db
}

/** Ensure the singleton backup_settings row exists; returns current settings. */
export function ensureBackupSettings(
  defaults?: EnsureBackupSettingsDefaults,
  db?: Database.Database
): BackupSettings {
  const database = resolveDb(db)
  const existing = database.prepare(`SELECT * FROM backup_settings WHERE id = 1`).get() as
    BackupSettingsRow | undefined

  if (existing) {
    return mapSettings(existing)
  }

  const now = new Date().toISOString()
  const interval = normalizeIntervalHours(defaults?.intervalHours ?? DEFAULT_BACKUP_INTERVAL_HOURS)
  const provider = normalizeProvider(defaults?.provider ?? null)
  const next = new Date(Date.now() + interval * 60 * 60 * 1000).toISOString()

  database
    .prepare(
      `INSERT INTO backup_settings (
      id, auto_backup_enabled, backup_interval_hours, provider,
      last_backup_time, next_backup_time, updated_at
    ) VALUES (1, 1, @interval, @provider, NULL, @next, @now)`
    )
    .run({
      interval,
      provider,
      next,
      now
    })

  return getBackupSettings(database)
}

export function getBackupSettings(db?: Database.Database): BackupSettings {
  return ensureBackupSettings(undefined, db)
}

export function updateBackupSettings(
  patch: BackupSettingsPatch,
  db?: Database.Database
): BackupSettings {
  const database = resolveDb(db)
  const current = ensureBackupSettings(undefined, database)
  const now = new Date().toISOString()

  const autoBackupEnabled =
    patch.autoBackupEnabled !== undefined ? patch.autoBackupEnabled : current.autoBackupEnabled
  const backupIntervalHours =
    patch.backupIntervalHours !== undefined
      ? normalizeIntervalHours(patch.backupIntervalHours)
      : current.backupIntervalHours
  const provider =
    patch.provider !== undefined ? normalizeProvider(patch.provider) : current.provider
  const lastBackupTime =
    patch.lastBackupTime !== undefined ? patch.lastBackupTime : current.lastBackupTime

  let nextBackupTime: string | null
  if (patch.nextBackupTime !== undefined) {
    nextBackupTime = patch.nextBackupTime
  } else if (
    patch.backupIntervalHours !== undefined ||
    patch.autoBackupEnabled === true ||
    (patch.lastBackupTime !== undefined && patch.lastBackupTime)
  ) {
    const base = lastBackupTime ? Date.parse(lastBackupTime) : Date.now()
    nextBackupTime = new Date(base + backupIntervalHours * 60 * 60 * 1000).toISOString()
  } else if (patch.autoBackupEnabled === false) {
    nextBackupTime = current.nextBackupTime
  } else {
    nextBackupTime = current.nextBackupTime
  }

  database
    .prepare(
      `UPDATE backup_settings SET
      auto_backup_enabled = @auto,
      backup_interval_hours = @interval,
      provider = @provider,
      last_backup_time = @last,
      next_backup_time = @next,
      updated_at = @now
    WHERE id = 1`
    )
    .run({
      auto: autoBackupEnabled ? 1 : 0,
      interval: backupIntervalHours,
      provider,
      last: lastBackupTime,
      next: nextBackupTime,
      now
    })

  return getBackupSettings(database)
}

export function insertBackupLog(input: NewBackupLogInput, db?: Database.Database): BackupLogRecord {
  const database = resolveDb(db)
  const now = new Date().toISOString()
  const id = input.id ?? randomUUID()
  const timestamp = input.timestamp ?? now
  const recordCount = JSON.stringify(input.recordCount ?? {})

  database
    .prepare(
      `INSERT INTO backup_logs (
      id, timestamp, type, target_user_email, status, file_name, file_size,
      record_count, local_path, error_message, created_at
    ) VALUES (
      @id, @timestamp, @type, @email, @status, @fileName, @fileSize,
      @recordCount, @localPath, @error, @createdAt
    )`
    )
    .run({
      id,
      timestamp,
      type: input.type ?? 'Full',
      email: input.targetUserEmail ?? null,
      status: input.status,
      fileName: input.fileName,
      fileSize: input.fileSize ?? '',
      recordCount,
      localPath: input.localPath ?? null,
      error: input.errorMessage ?? null,
      createdAt: now
    })

  return getBackupLog(id, database)!
}

export function getBackupLog(id: string, db?: Database.Database): BackupLogRecord | null {
  const row = resolveDb(db).prepare(`SELECT * FROM backup_logs WHERE id = ?`).get(id) as
    BackupLogRow | undefined
  return row ? mapLog(row) : null
}

export function listRecentBackupLogs(limit = 20, db?: Database.Database): BackupLogRecord[] {
  const rows = resolveDb(db)
    .prepare(`SELECT * FROM backup_logs ORDER BY timestamp DESC LIMIT ?`)
    .all(Math.max(1, Math.min(limit, 200))) as BackupLogRow[]
  return rows.map(mapLog)
}

/** Snapshot entity counts for BackupLog.recordCount (single-user). */
export function countBackupRecords(db?: Database.Database): Record<string, number> {
  const database = resolveDb(db)
  const count = (table: string): number =>
    (database.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c

  return {
    parts: count('parts'),
    systems: count('systems'),
    logs: count('shooting_logs'),
    ammo: count('ammo_inventory'),
    loads: count('load_developments'),
    users: count('profile')
  }
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 KB'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(2)} KB`
  return `${(kb / 1024).toFixed(2)} MB`
}

export function buildBackupFileName(date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}`
  return `materiel-backup-${stamp}.db`
}
