import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { getAppliedMigrationVersion, MIGRATIONS } from '../migrate'
import { openTestDatabase } from '../connection'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-db-'))
  dirs.push(dir)
  return join(dir, 'test.db')
}

test('migrations run forward from empty encrypted DB', () => {
  const db = openTestDatabase(tempDbPath())
  try {
    assert.equal(getAppliedMigrationVersion(db), MIGRATIONS[MIGRATIONS.length - 1].id)

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all() as Array<{ name: string }>

    const names = tables.map((t) => t.name)
    for (const expected of [
      'ammo_inventory',
      'backup_logs',
      'backup_settings',
      'license_state',
      'load_developments',
      'parts',
      'profile',
      'schema_migrations',
      'shooting_logs',
      'system_misc_parts',
      'systems'
    ]) {
      assert.ok(names.includes(expected), `missing table ${expected}`)
    }

    // Re-open / re-migrate is a no-op.
    const versionAgain = getAppliedMigrationVersion(db)
    assert.equal(versionAgain, 1)
  } finally {
    db.close()
  }
})

test('wrong key cannot read encrypted DB', () => {
  const path = tempDbPath()
  const db = openTestDatabase(path, 'correct-passphrase')
  db.prepare(
    `INSERT INTO profile (id, first_name, last_name, created_at, updated_at)
     VALUES ('p1', 'A', 'B', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
  ).run()
  db.close()

  assert.throws(() => openTestDatabase(path, 'wrong-passphrase'))
})
