import type Database from 'better-sqlite3-multiple-ciphers'
import * as migration001 from './migrations/001_initial'

export type Migration = {
  id: number
  name: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  { id: migration001.id, name: migration001.name, sql: migration001.sql }
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
