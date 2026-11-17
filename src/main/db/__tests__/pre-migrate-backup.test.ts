import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import {
  backupDatabaseBeforeMigrate,
  formatBackupTimestamp,
  resolvePreMigrateBackupDir
} from '../pre-migrate-backup'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-backup-'))
  dirs.push(dir)
  return dir
}

test('formatBackupTimestamp is filename-safe', () => {
  const stamp = formatBackupTimestamp(new Date('2026-11-17T01:02:03.456Z'))
  assert.equal(stamp, '2026-11-17T01-02-03-456Z')
  assert.ok(!stamp.includes(':'))
})

test('resolvePreMigrateBackupDir sits beside userData', () => {
  const dbPath = '/tmp/Support/Materiel/materiel.db'
  assert.equal(
    resolvePreMigrateBackupDir(dbPath, '2026-11-17T01-02-03-456Z'),
    '/tmp/Support/Materiel-db-backup-2026-11-17T01-02-03-456Z'
  )
})

test('backupDatabaseBeforeMigrate returns null when DB missing', () => {
  const root = tempRoot()
  const userData = join(root, 'Materiel')
  mkdirSync(userData)
  const result = backupDatabaseBeforeMigrate(join(userData, 'materiel.db'))
  assert.equal(result, null)
})

test('backupDatabaseBeforeMigrate copies db and key files beside userData', () => {
  const root = tempRoot()
  const userData = join(root, 'Materiel')
  mkdirSync(userData)
  const dbPath = join(userData, 'materiel.db')
  const keyPath = `${dbPath}.key`
  const devKeyPath = `${dbPath}.key.dev`

  writeFileSync(dbPath, 'db-bytes')
  writeFileSync(keyPath, 'key-bytes')
  writeFileSync(devKeyPath, 'dev-key')

  const result = backupDatabaseBeforeMigrate(dbPath, {
    timestamp: '2026-11-17T01-02-03-000Z'
  })

  assert.ok(result)
  assert.equal(result.backupDir, join(root, 'Materiel-db-backup-2026-11-17T01-02-03-000Z'))
  assert.deepEqual(result.copiedFiles.sort(), [
    'materiel.db',
    'materiel.db.key',
    'materiel.db.key.dev'
  ])

  assert.equal(readFileSync(join(result.backupDir, 'materiel.db'), 'utf8'), 'db-bytes')
  assert.equal(readFileSync(join(result.backupDir, 'materiel.db.key'), 'utf8'), 'key-bytes')
  assert.equal(readFileSync(join(result.backupDir, 'materiel.db.key.dev'), 'utf8'), 'dev-key')

  // Live files untouched.
  assert.equal(readFileSync(dbPath, 'utf8'), 'db-bytes')
  assert.ok(existsSync(keyPath))
})

test('backupDatabaseBeforeMigrate skips missing key files', () => {
  const root = tempRoot()
  const userData = join(root, 'Materiel')
  mkdirSync(userData)
  const dbPath = join(userData, 'materiel.db')
  writeFileSync(dbPath, 'only-db')

  const result = backupDatabaseBeforeMigrate(dbPath, { timestamp: 'stamp1' })
  assert.ok(result)
  assert.deepEqual(result.copiedFiles, ['materiel.db'])
})
