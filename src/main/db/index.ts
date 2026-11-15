/**
 * Encrypted SQLite data layer for Materiel.
 *
 * - AES-256 at rest via better-sqlite3-multiple-ciphers (SQLCipher cipher)
 * - Forward migrations from empty DB
 * - Transactional shooting-log side effects (§7.2)
 * - Factory rifle part synthesis (§7.1)
 *
 * Key supply: see docs/database.md (default = Electron safeStorage).
 */

import { app } from 'electron'
import { join } from 'path'
import {
  closeDatabase as closeConnection,
  getDatabase as getConnection,
  getHealth as getConnectionHealth,
  openDatabase as openConnection,
  requireDatabase as requireConnection,
  type DatabaseHandle,
  type OpenDatabaseOptions as CoreOpenOptions
} from './connection'

export type { DatabaseHandle } from './connection'
export type { DatabaseHealth } from './types'
export * from './types'
export {
  addShootingLog,
  updateShootingLog,
  deleteShootingLog,
  getShootingLog,
  listShootingLogs
} from './shooting-logs'
export {
  synthesizeFactoryParts,
  deleteSynthesizedFactoryParts,
  factoryPartIds,
  createCustomSystem,
  createFactorySystem,
  updateSystem,
  deleteSystem,
  getSystem,
  countCompleteSystems
} from './systems'
export { migrate, getAppliedMigrationVersion, MIGRATIONS } from './migrate'
export { seedDemoIfEmpty } from './seed'
export { resolveDatabaseKey, DB_CIPHER } from './key'
export { openTestDatabase, openEncryptedConnection } from './connection'

export type OpenDatabaseOptions = Omit<CoreOpenOptions, 'path'> & {
  path?: string
}

export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'materiel.db')
}

export function openDatabase(options: OpenDatabaseOptions = {}): DatabaseHandle {
  return openConnection({
    ...options,
    path: options.path ?? getDatabasePath()
  })
}

/** App bootstrap — opens the default userData DB. */
export function initDatabase(options: OpenDatabaseOptions = {}): DatabaseHandle {
  return openDatabase(options)
}

export function getDatabase(): DatabaseHandle | null {
  return getConnection()
}

export function requireDatabase(): DatabaseHandle {
  return requireConnection()
}

export function getHealth(): ReturnType<typeof getConnectionHealth> {
  return getConnectionHealth()
}

export function closeDatabase(): void {
  closeConnection()
}
