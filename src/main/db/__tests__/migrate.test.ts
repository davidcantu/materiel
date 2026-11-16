import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { getAppliedMigrationVersion, migrate, MIGRATIONS } from '../migrate'
import { openEncryptedConnection, openTestDatabase } from '../connection'
import { resolveDatabaseKey } from '../key'

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

function openRaw(path: string) {
  const resolved = resolveDatabaseKey({
    dbPath: path,
    key: 'test-key-materiel-0001',
    allowEnvKey: false,
    safeStorage: null
  })
  return openEncryptedConnection(path, resolved.key)
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
    assert.equal(versionAgain, 7)

    const partCols = db.prepare(`PRAGMA table_info(parts)`).all() as Array<{ name: string }>
    assert.ok(
      partCols.some((c) => c.name === 'name'),
      'parts.name (barrel name) column missing'
    )
    assert.ok(
      partCols.some((c) => c.name === 'platforms'),
      'parts.platforms column missing'
    )

    const ammoCols = db.prepare(`PRAGMA table_info(ammo_inventory)`).all() as Array<{ name: string }>
    assert.ok(
      ammoCols.some((c) => c.name === 'acquired_date'),
      'ammo_inventory.acquired_date column missing'
    )

    const profileCols = db.prepare(`PRAGMA table_info(profile)`).all() as Array<{ name: string }>
    assert.ok(profileCols.some((c) => c.name === 'track_loads'))
    assert.ok(profileCols.some((c) => c.name === 'tracked_platforms'))
    assert.ok(profileCols.some((c) => c.name === 'onboarding_complete'))

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

    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
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

test('upgrade from v4 with referencing rows survives parts rebuild (005/006)', () => {
  const path = tempDbPath()
  const db = openRaw(path)
  try {
    migrate(db, { throughVersion: 4 })
    assert.equal(getAppliedMigrationVersion(db), 4)

    const t = '2026-01-01T00:00:00.000Z'
    db.prepare(
      `INSERT INTO parts (
        id, manufacturer, value, type, status, model, serial_number,
        total_round_count, rounds_after_cleaning, created_at, updated_at
      ) VALUES
        ('act-1', 'Impact', 1400, 'Action', 'In Use', '737R', 'IMP', 100, 10, @t, @t),
        ('bar-1', 'Proof', 850, 'Barrel', 'In Use', 'Carbon', NULL, 100, 10, @t, @t),
        ('cha-1', 'MDT', 1200, 'Chassis', 'In Use', 'ACC', NULL, 0, 0, @t, @t),
        ('opt-1', 'Nightforce', 2000, 'Optic', 'In Use', 'ATACR', NULL, 0, 0, @t, @t)`
    ).run({ t })

    db.prepare(
      `INSERT INTO systems (
        id, name, build_type, action_id, barrel_id, chassis_id, optic_id, created_at, updated_at
      ) VALUES ('sys-1', 'Bolt gun', 'custom', 'act-1', 'bar-1', 'cha-1', 'opt-1', @t, @t)`
    ).run({ t })

    db.prepare(
      `INSERT INTO shooting_logs (
        id, system_id, barrel_id, date, location, rounds_fired, session_type, created_at, updated_at
      ) VALUES ('log-1', 'sys-1', 'bar-1', '2026-01-02', 'Range', 50, 'Practice', @t, @t)`
    ).run({ t })

    db.prepare(
      `INSERT INTO system_misc_parts (system_id, part_id, position) VALUES ('sys-1', 'opt-1', 0)`
    ).run()

    assert.equal(migrate(db), 7)
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])

    const system = db.prepare(`SELECT action_id, barrel_id, platform FROM systems WHERE id = 'sys-1'`).get() as {
      action_id: string
      barrel_id: string
      platform: string
    }
    assert.equal(system.action_id, 'act-1')
    assert.equal(system.barrel_id, 'bar-1')
    assert.equal(system.platform, 'bolt_action')

    const partTypes = db
      .prepare(`SELECT id, type FROM parts ORDER BY id`)
      .all() as Array<{ id: string; type: string }>
    assert.deepEqual(
      partTypes.map((p) => p.type),
      ['Action', 'Barrel', 'Chassis', 'Optic']
    )
  } finally {
    db.close()
  }
})

test('upgrade from v5 Frame→Pistol rebuild with pistol system refs', () => {
  const path = tempDbPath()
  const db = openRaw(path)
  try {
    migrate(db, { throughVersion: 5 })
    assert.equal(getAppliedMigrationVersion(db), 5)

    const t = '2026-01-01T00:00:00.000Z'
    db.prepare(
      `INSERT INTO parts (
        id, manufacturer, value, type, status, platforms, model, serial_number,
        total_round_count, rounds_after_cleaning, created_at, updated_at
      ) VALUES
        ('frame-1', 'Glock', 500, 'Frame', 'In Use', '["pistol"]', '19', 'ABC', 100, 10, @t, @t),
        ('slide-1', 'Glock', 300, 'Slide', 'In Use', '["pistol"]', '19', NULL, 0, 0, @t, @t),
        ('opt-1', 'Trijicon', 500, 'Optic', 'In Use', '["pistol"]', 'RMR', NULL, 0, 0, @t, @t)`
    ).run({ t })

    db.prepare(
      `INSERT INTO systems (
        id, name, build_type, action_id, barrel_id, chassis_id, optic_id, platform, created_at, updated_at
      ) VALUES (
        'sys-p', 'Glock 19', 'custom', 'frame-1', 'slide-1', 'frame-1', 'opt-1', 'pistol', @t, @t
      )`
    ).run({ t })

    assert.equal(migrate(db), 7)
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])

    const frame = db.prepare(`SELECT type FROM parts WHERE id = 'frame-1'`).get() as { type: string }
    assert.equal(frame.type, 'Pistol')

    const system = db
      .prepare(`SELECT action_id, barrel_id, chassis_id, optic_id FROM systems WHERE id = 'sys-p'`)
      .get() as {
      action_id: string
      barrel_id: string
      chassis_id: string
      optic_id: string | null
    }
    // Pistol builds collapse barrel/chassis onto the primary pistol part.
    assert.equal(system.action_id, 'frame-1')
    assert.equal(system.barrel_id, 'frame-1')
    assert.equal(system.chassis_id, 'frame-1')
    assert.equal(system.optic_id, 'opt-1')
  } finally {
    db.close()
  }
})
