/**
 * Encrypted connection + open/migrate without importing Electron.
 * Used by the main-process facade and by Node unit tests.
 */

import { mkdirSync } from 'fs'
import { dirname } from 'path'
import Database from 'better-sqlite3-multiple-ciphers'
import { DB_CIPHER, keyFingerprint, resolveDatabaseKey, type ResolveKeyOptions } from './key'
import { getAppliedMigrationVersion, migrate } from './migrate'
import { seedDemoIfEmpty } from './seed'
import type { DatabaseHealth } from './types'

export type DatabaseHandle = {
  path: string
  ready: boolean
  migrationVersion: number
  keySource: string
  keyFingerprint: string
  db: Database.Database
}

export type OpenDatabaseOptions = {
  path: string
  key?: string | Buffer
  passphrase?: string
  safeStorage?: ResolveKeyOptions['safeStorage']
  keyFilePath?: string
  seedDemo?: boolean
  allowEnvKey?: boolean
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

  const resolved = resolveDatabaseKey({
    dbPath: options.path,
    key: options.key,
    passphrase: options.passphrase,
    safeStorage: options.safeStorage,
    keyFilePath: options.keyFilePath,
    allowEnvKey: options.allowEnvKey
  })

  const db = openEncryptedConnection(options.path, resolved.key)
  const migrationVersion = migrate(db)

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
    db
  }

  console.info(
    `[db] ready path=${options.path} migrations=${migrationVersion} keySource=${resolved.source}`
  )
  return handle
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
