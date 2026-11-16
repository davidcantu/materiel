import type Database from 'better-sqlite3-multiple-ciphers'
import * as migration001 from './migrations/001_initial'
import * as migration002 from './migrations/002_drop_part_name'
import * as migration003 from './migrations/003_profile_username'
import * as migration004 from './migrations/004_email_identity'
import * as migration005 from './migrations/005_platforms'
import * as migration006 from './migrations/006_simplify_platform_parts'
import * as migration007 from './migrations/007_ux_prefs_barrel_ammo_date'

export type Migration = {
  id: number
  name: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  { id: migration001.id, name: migration001.name, sql: migration001.sql },
  { id: migration002.id, name: migration002.name, sql: migration002.sql },
  { id: migration003.id, name: migration003.name, sql: migration003.sql },
  { id: migration004.id, name: migration004.name, sql: migration004.sql },
  { id: migration005.id, name: migration005.name, sql: migration005.sql },
  { id: migration006.id, name: migration006.name, sql: migration006.sql },
  { id: migration007.id, name: migration007.name, sql: migration007.sql }
]

export function getAppliedMigrationVersion(db: Database.Database): number {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'`)
    .get() as { name: string } | undefined

  if (!row) {
    return 0
  }

  const latest = db
    .prepare(`SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations`)
    .get() as { version: number }

  return latest.version
}

/**
 * Apply all pending migrations forward from an empty or older DB.
 * Returns the version after migration.
 */
export function migrate(db: Database.Database): number {
  db.pragma('foreign_keys = ON')

  const applied = getAppliedMigrationVersion(db)
  const pending = MIGRATIONS.filter((m) => m.id > applied).sort((a, b) => a.id - b.id)

  if (pending.length === 0) {
    return applied
  }

  const runAll = db.transaction((migrations: Migration[]) => {
    for (const migration of migrations) {
      db.exec(migration.sql)
      // Prepare after exec so 001 can create schema_migrations first.
      db.prepare(
        `INSERT INTO schema_migrations (version, name, applied_at) VALUES (@version, @name, @appliedAt)`
      ).run({
        version: migration.id,
        name: migration.name,
        appliedAt: new Date().toISOString()
      })
    }
  })

  runAll(pending)
  return getAppliedMigrationVersion(db)
}
