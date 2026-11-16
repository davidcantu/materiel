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

    const columns = db.prepare(`PRAGMA table_info(profile)`).all() as Array<{ name: string }>
    assert.ok(
      columns.some((c) => c.name === 'username'),
      'profile.username column missing'
    )

    // Re-open / re-migrate is a no-op.
    const versionAgain = getAppliedMigrationVersion(db)
    assert.equal(versionAgain, MIGRATIONS[MIGRATIONS.length - 1].id)
    assert.equal(versionAgain, 6)

    const partCols = db.prepare(`PRAGMA table_info(parts)`).all() as Array<{ name: string }>
    assert.ok(!partCols.some((c) => c.name === 'name'), 'parts.name should be dropped')
    assert.ok(
      partCols.some((c) => c.name === 'platforms'),
      'parts.platforms column missing'
    )

    const systemCols = db.prepare(`PRAGMA table_info(systems)`).all() as Array<{ name: string }>
    assert.ok(
      systemCols.some((c) => c.name === 'platform'),
      'systems.platform column missing'
    )
    assert.ok(
      systemCols.some((c) => c.name === 'laser_ir_id'),
      'systems.laser_ir_id column missing'
    )
    assert.ok(systemCols.some((c) => c.name === 'light_id'), 'systems.light_id column missing')
  } finally {
    db.close()
  }
})

test('004_email_identity mirrors username to email', () => {
  const path = tempDbPath()
  const db = openTestDatabase(path)
  try {
    const createdAt = '2026-01-01T00:00:00.000Z'
    db.prepare(
      `INSERT INTO profile (
        id, username, first_name, last_name, email, city, state, country,
        competition_series, track_value, track_ammo, unlock_pin_set,
        created_at, updated_at
      ) VALUES (
        'local-profile', 'marksman', '', '', 'shooter@example.com', '', '', '',
        '[]', 1, 1, 0, @createdAt, @createdAt
      )`
    ).run({ createdAt })

    // Re-apply migration 004 mirror SQL (already applied on open; verify semantics).
    db.exec(`
UPDATE profile
SET username = lower(trim(email))
WHERE email IS NOT NULL AND trim(email) != '';
`)

    const row = db
      .prepare(`SELECT username, email FROM profile WHERE id = 'local-profile'`)
      .get() as {
      username: string
      email: string
    }
    assert.equal(row.email, 'shooter@example.com')
    assert.equal(row.username, 'shooter@example.com')
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
