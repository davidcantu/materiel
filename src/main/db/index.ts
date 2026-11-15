/**
 * Encrypted SQLite data layer (stub).
 *
 * TODO:
 * - Open better-sqlite3-multiple-ciphers with AES-256 passphrase
 * - Run migrations for Parts / Systems / Logs / Ammo / Loads / Settings
 * - Expose transactional helpers for log side-effects (spec §7.2)
 */

import { app } from 'electron'
import { join } from 'path'

export type DatabaseHandle = {
  path: string
  ready: boolean
}

let handle: DatabaseHandle | null = null

export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'materiel.db')
}

/**
 * Stub initializer — does not open a real connection yet.
 * Follow-up: import Database from 'better-sqlite3-multiple-ciphers'
 * and apply encryption + schema migrations.
 */
export function initDatabase(): DatabaseHandle {
  const path = getDatabasePath()
  // TODO: const Database = require('better-sqlite3-multiple-ciphers')
  // TODO: const db = new Database(path); db.pragma(`key = '...'`)
  handle = { path, ready: false }
  console.info('[db] stub ready; schema migrations not implemented yet:', path)
  return handle
}

export function getDatabase(): DatabaseHandle | null {
  return handle
}

export function closeDatabase(): void {
  // TODO: db.close()
  handle = null
}
