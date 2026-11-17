import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import {
  buildDatabaseInitFailureDetail,
  buildDatabaseInitFailureHtml,
  DatabaseInitError,
  toDatabaseInitFailure
} from '../init-error'
import { closeDatabase, getDatabase, openDatabase, openEncryptedConnection } from '../connection'
import { resolveDatabaseKey } from '../key'
import { migrate } from '../migrate'
import { backupDatabaseBeforeMigrate } from '../pre-migrate-backup'

const dirs: string[] = []

afterEach(() => {
  closeDatabase()
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function tempUserDataDb(): string {
  const root = mkdtempSync(join(tmpdir(), 'materiel-init-'))
  dirs.push(root)
  const userData = join(root, 'Materiel')
  mkdirSync(userData)
  return join(userData, 'materiel.db')
}

test('DatabaseInitError carries backup path and does not claim wipe', () => {
  const err = new DatabaseInitError('Materiel could not upgrade its local database.', {
    dbPath: '/tmp/Materiel/materiel.db',
    backupDir: '/tmp/Materiel-db-backup-1',
    cause: new Error('FOREIGN KEY constraint failed')
  })
  const failure = err.toFailure()
  assert.equal(failure.backupDir, '/tmp/Materiel-db-backup-1')
  assert.match(failure.detail, /FOREIGN KEY/)

  const detail = buildDatabaseInitFailureDetail(failure)
  assert.match(detail, /not deleted/i)
  assert.match(detail, /Backup copy: \/tmp\/Materiel-db-backup-1/)
  assert.match(detail, /Console\.app/)
  assert.doesNotMatch(detail, /delet(e|ed) your database/i)
})

test('failure HTML escapes content and keeps brand + backup path', () => {
  const html = buildDatabaseInitFailureHtml({
    message: 'upgrade failed',
    detail: 'boom <script>alert(1)</script>',
    dbPath: '/data/materiel.db',
    backupDir: '/data-backup'
  })
  assert.match(html, /MATERIEL/)
  assert.match(html, /not deleted/i)
  assert.match(html, /\/data-backup/)
  assert.match(html, /boom &lt;script&gt;/)
  assert.doesNotMatch(html, /<script>alert/)
})

test('toDatabaseInitFailure preserves DatabaseInitError fields', () => {
  const original = new DatabaseInitError('open failed', {
    dbPath: '/x/materiel.db',
    backupDir: '/x-backup',
    cause: 'nope'
  })
  const failure = toDatabaseInitFailure(original)
  assert.equal(failure.dbPath, '/x/materiel.db')
  assert.equal(failure.backupDir, '/x-backup')
  assert.equal(failure.message, 'open failed')
})

test('openDatabase backs up then surfaces migrate failure without wiping live DB', () => {
  const dbPath = tempUserDataDb()
  // Leave schema below latest so hasPendingMigrations is true and backup runs.
  const seeded = openEncryptedConnection(
    dbPath,
    resolveDatabaseKey({
      dbPath,
      key: 'test-key-materiel-0001',
      allowEnvKey: false,
      safeStorage: null
    }).key
  )
  migrate(seeded, { throughVersion: 1 })
  seeded.close()

  const before = readFileSync(dbPath)
  closeDatabase()

  let backupDir: string | null = null
  let backupCalls = 0

  assert.throws(
    () =>
      openDatabase({
        path: dbPath,
        key: 'test-key-materiel-0001',
        allowEnvKey: false,
        safeStorage: null,
        seedDemo: false,
        deps: {
          backupBeforeMigrate: (path) => {
            backupCalls += 1
            const result = backupDatabaseBeforeMigrate(path, { timestamp: 'migrate-fail-test' })
            backupDir = result?.backupDir ?? null
            return result
          },
          migrate: () => {
            throw new Error('simulated migrate failure')
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof DatabaseInitError)
      assert.equal(error.backupDir, backupDir)
      assert.match(error.detail, /simulated migrate failure/)
      return true
    }
  )

  assert.equal(getDatabase(), null)
  assert.equal(backupCalls, 1)
  assert.ok(backupDir)
  assert.deepEqual(readFileSync(dbPath), before)
  assert.deepEqual(readFileSync(join(backupDir!, 'materiel.db')), before)
})

test('openDatabase wraps key/open failures as DatabaseInitError without wiping', () => {
  const dbPath = tempUserDataDb()
  writeFileSync(dbPath, 'not-a-sqlite-file')

  assert.throws(
    () =>
      openDatabase({
        path: dbPath,
        key: 'test-key-materiel-0001',
        allowEnvKey: false,
        safeStorage: null,
        seedDemo: false
      }),
    (error: unknown) => {
      assert.ok(error instanceof DatabaseInitError)
      assert.equal(error.dbPath, dbPath)
      // Open failed before migrate — no pre-migrate backup required.
      assert.equal(error.backupDir, null)
      return true
    }
  )

  assert.equal(getDatabase(), null)
  // Original bytes preserved (no wipe).
  assert.equal(readFileSync(dbPath, 'utf8'), 'not-a-sqlite-file')
})
