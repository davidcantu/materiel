import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import {
  DEFAULT_BACKUP_INTERVAL_HOURS,
  buildBackupFileName,
  countBackupRecords,
  ensureBackupSettings,
  formatFileSize,
  insertBackupLog,
  listRecentBackupLogs,
  updateBackupSettings
} from '../backup'
import { openTestDatabase } from '../connection'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-backup-'))
  dirs.push(dir)
  return join(dir, 'test.db')
}

test('ensureBackupSettings creates hourly defaults', () => {
  const db = openTestDatabase(tempDbPath())
  try {
    const settings = ensureBackupSettings({ provider: 'mock', intervalHours: 1 }, db)
    assert.equal(settings.autoBackupEnabled, true)
    assert.equal(settings.backupIntervalHours, DEFAULT_BACKUP_INTERVAL_HOURS)
    assert.equal(settings.provider, 'mock')
    assert.ok(settings.nextBackupTime)

    const again = ensureBackupSettings({ provider: 'google-drive' }, db)
    assert.equal(again.provider, 'mock')
  } finally {
    db.close()
  }
})

test('updateBackupSettings normalizes interval and advances next time', () => {
  const db = openTestDatabase(tempDbPath())
  try {
    ensureBackupSettings({ provider: 'mock' }, db)
    const updated = updateBackupSettings(
      {
        backupIntervalHours: 12,
        lastBackupTime: '2026-01-01T00:00:00.000Z',
        autoBackupEnabled: true
      },
      db
    )
    assert.equal(updated.backupIntervalHours, 12)
    assert.equal(updated.lastBackupTime, '2026-01-01T00:00:00.000Z')
    assert.equal(updated.nextBackupTime, '2026-01-01T12:00:00.000Z')

    const invalid = updateBackupSettings({ backupIntervalHours: 99 }, db)
    assert.equal(invalid.backupIntervalHours, DEFAULT_BACKUP_INTERVAL_HOURS)
  } finally {
    db.close()
  }
})

test('insertBackupLog + listRecentBackupLogs', () => {
  const db = openTestDatabase(tempDbPath())
  try {
    insertBackupLog(
      {
        status: 'Success',
        fileName: 'materiel-backup-test.db',
        fileSize: '12.00 KB',
        recordCount: { parts: 1, systems: 0, logs: 0, ammo: 0, loads: 0, users: 1 }
      },
      db
    )
    insertBackupLog(
      {
        status: 'Failed',
        fileName: 'materiel-backup-fail.db',
        errorMessage: 'boom'
      },
      db
    )

    const logs = listRecentBackupLogs(10, db)
    assert.equal(logs.length, 2)
    assert.equal(logs[0].status, 'Failed')
    assert.equal(logs[1].fileName, 'materiel-backup-test.db')
    assert.equal(logs[1].recordCount.parts, 1)

    const counts = countBackupRecords(db)
    assert.equal(typeof counts.parts, 'number')
  } finally {
    db.close()
  }
})

test('formatFileSize and buildBackupFileName helpers', () => {
  assert.equal(formatFileSize(1024), '1.00 KB')
  assert.match(buildBackupFileName(new Date('2026-11-15T20:00:00')), /^materiel-backup-/)
})
