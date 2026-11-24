/**
 * Encrypted connection + open/migrate without importing Electron.
 * Used by the main-process facade and by Node unit tests.
 */

import { mkdirSync } from 'fs'
import { dirname } from 'path'
import Database from 'better-sqlite3-multiple-ciphers'
import { DatabaseInitError } from './init-error'
import { DB_CIPHER, keyFingerprint, resolveDatabaseKey, type ResolveKeyOptions } from './key'
import { getAppliedMigrationVersion, migrate, MIGRATIONS } from './migrate'
import { backupDatabaseBeforeMigrate, type PreMigrateBackupResult } from './pre-migrate-backup'
import { seedDemoIfEmpty } from './seed'
import type { DatabaseHealth } from './types'

/** True when an existing schema will be upgraded (skip empty first-launch DBs). */
function shouldBackupBeforeMigrate(db: Database.Database): boolean {
  const applied = getAppliedMigrationVersion(db)
  const latest = MIGRATIONS[MIGRATIONS.length - 1]?.id ?? 0
  return applied > 0 && applied < latest
}

export type DatabaseHandle = {
  path: string
  ready: boolean
  migrationVersion: number
  keySource: string
  keyFingerprint: string
  /**
   * In-memory SQLCipher key for this session (never log / never IPC).
   * Used to enable unlock wrapping without reading the auto key file.
   */
  keyMaterial: Buffer
  db: Database.Database
  /** Set when a pre-migrate backup was written for this open. */
  preMigrateBackupDir: string | null
}

export type OpenDatabaseDeps = {
  migrate?: typeof migrate
  backupBeforeMigrate?: typeof backupDatabaseBeforeMigrate
}

export type OpenDatabaseOptions = {
  path: string
  key?: string | Buffer
  passphrase?: string
  safeStorage?: ResolveKeyOptions['safeStorage']
  keyFilePath?: string
  seedDemo?: boolean
  allowEnvKey?: boolean
  /** Test-only injectable deps (backup / migrate). */
  deps?: OpenDatabaseDeps
}

let handle: DatabaseHandle | null = null

function shouldSeedDemo(options: OpenDatabaseOptions): boolean {
  if (options.seedDemo === true) return true
  if (options.seedDemo === false) return false
  return process.env.MAIN_VITE_SEED_DEMO === 'true'
}

export function openEncryptedConnection(dbPath: string, key: Buffer): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma(`cipher='${DB_CIPHER}'`)
  db.key(key)
  db.pragma('foreign_keys = ON')
  db.prepare('SELECT 1').get()
  return db
}

export function openDatabase(options: OpenDatabaseOptions): DatabaseHandle {
  if (handle?.ready) {
    return handle
  }

  const runMigrate = options.deps?.migrate ?? migrate
  const runBackup = options.deps?.backupBeforeMigrate ?? backupDatabaseBeforeMigrate

  let backup: PreMigrateBackupResult | null = null

  try {
    const resolved = resolveDatabaseKey({
      dbPath: options.path,
      key: options.key,
      passphrase: options.passphrase,
      safeStorage: options.safeStorage,
      keyFilePath: options.keyFilePath,
      allowEnvKey: options.allowEnvKey
    })

    const db = openEncryptedConnection(options.path, resolved.key)
    let migrationVersion: number
    try {
      // Snapshot before upgrading an existing schema — never deletes the live files.
      if (shouldBackupBeforeMigrate(db)) {
        backup = runBackup(options.path)
        if (backup) {
          console.info(
            `[db] pre-migrate backup → ${backup.backupDir} (${backup.copiedFiles.join(', ')})`
          )
        }
      }

      migrationVersion = runMigrate(db)
    } catch (error) {
      try {
        db.close()
      } catch (closeError) {
        console.warn('[db] close after migrate failure', closeError)
      }
      throw new DatabaseInitError('Materiel could not upgrade its local database.', {
        dbPath: options.path,
        backupDir: backup?.backupDir ?? null,
        cause: error
      })
    }

    if (shouldSeedDemo(options)) {
      const seeded = seedDemoIfEmpty(db)
      if (seeded) {
        console.info('[db] demo seed applied')
      }
    }

    handle = {
      path: options.path,
      ready: true,
      migrationVersion,
      keySource: resolved.source,
      keyFingerprint: keyFingerprint(resolved.key),
      keyMaterial: Buffer.from(resolved.key),
      db,
      preMigrateBackupDir: backup?.backupDir ?? null
    }

    console.info(
      `[db] ready path=${options.path} migrations=${migrationVersion} keySource=${resolved.source}`
    )
    return handle
  } catch (error) {
    if (error instanceof DatabaseInitError) {
      throw error
    }
    throw new DatabaseInitError('Materiel could not open its local database.', {
      dbPath: options.path,
      backupDir: backup?.backupDir ?? null,
      cause: error
    })
  }
}

export function getDatabase(): DatabaseHandle | null {
  return handle
}

export function requireDatabase(): DatabaseHandle {
  if (!handle?.ready) {
    throw new Error('Database is not open')
  }
  return handle
}

export function getHealth(): DatabaseHealth {
  const current = requireDatabase()
  return {
    ready: true,
    path: current.path,
    cipher: DB_CIPHER,
    migrationVersion: getAppliedMigrationVersion(current.db),
    encrypted: true
  }
}

export function closeDatabase(): void {
  if (handle?.keyMaterial) {
    handle.keyMaterial.fill(0)
  }
  if (handle?.db) {
    try {
      handle.db.close()
    } catch (error) {
      console.warn('[db] close error', error)
    }
  }
  handle = null
}

/** Open a throwaway encrypted DB; does not touch the module singleton. */
export function openTestDatabase(
  dbPath: string,
  key: string | Buffer = 'test-key-materiel-0001'
): Database.Database {
  const resolved = resolveDatabaseKey({
    dbPath,
    key,
    allowEnvKey: false,
    safeStorage: null
  })
  const db = openEncryptedConnection(dbPath, resolved.key)
  migrate(db)
  return db
}
