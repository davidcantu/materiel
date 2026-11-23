import type Database from 'better-sqlite3-multiple-ciphers'
import * as migration001 from './migrations/001_initial'
import * as migration002 from './migrations/002_drop_part_name'
import * as migration003 from './migrations/003_profile_username'
import * as migration004 from './migrations/004_email_identity'
import * as migration005 from './migrations/005_platforms'
import * as migration006 from './migrations/006_simplify_platform_parts'
import * as migration007 from './migrations/007_ux_prefs_barrel_ammo_date'
import * as migration008 from './migrations/008_sold_note_match_place'
import * as migration009 from './migrations/009_drop_license_state'
import * as migration010 from './migrations/010_logs_nullable_system'
import * as migration011 from './migrations/011_system_total_rounds'
import * as migration012 from './migrations/012_load_fields_nullable_barrel'
import * as migration013 from './migrations/013_aar_ppews_ai'

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
  { id: migration007.id, name: migration007.name, sql: migration007.sql },
  { id: migration008.id, name: migration008.name, sql: migration008.sql },
  { id: migration009.id, name: migration009.name, sql: migration009.sql },
  { id: migration010.id, name: migration010.name, sql: migration010.sql },
  { id: migration011.id, name: migration011.name, sql: migration011.sql },
  { id: migration012.id, name: migration012.name, sql: migration012.sql },
  { id: migration013.id, name: migration013.name, sql: migration013.sql }
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

export type MigrateOptions = {
  /** Stop after this migration id (inclusive). Used by upgrade-path tests. */
  throughVersion?: number
}

/**
 * Apply all pending migrations forward from an empty or older DB.
 * Returns the version after migration.
 *
 * Foreign keys are disabled *outside* the migration transaction. SQLite treats
 * `PRAGMA foreign_keys = OFF` as a no-op while a multi-statement transaction is
 * open, so rebuild migrations that `DROP TABLE parts` (005/006) would otherwise
 * fail with FOREIGN KEY constraint failed when systems / shooting_logs /
 * system_misc_parts already reference part rows.
 */
export function migrate(db: Database.Database, options: MigrateOptions = {}): number {
  db.pragma('foreign_keys = ON')

  const applied = getAppliedMigrationVersion(db)
  const pending = MIGRATIONS.filter(
    (m) => m.id > applied && (options.throughVersion == null || m.id <= options.throughVersion)
  ).sort((a, b) => a.id - b.id)

  if (pending.length === 0) {
    return applied
  }

  db.pragma('foreign_keys = OFF')
  try {
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
  } finally {
    db.pragma('foreign_keys = ON')
  }

  const violations = db.prepare('PRAGMA foreign_key_check').all()
  if (violations.length > 0) {
    throw new Error(
      `Foreign key check failed after migrations: ${JSON.stringify(violations.slice(0, 5))}`
    )
  }

  return getAppliedMigrationVersion(db)
}
