import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { closeDatabase, openDatabase, requireDatabase } from '../../db/connection'
import { createCustomSystem } from '../../db/systems'
import { activateLicense, clearLicense } from '../activate'
import { issueLicenseKey } from '../crypto'
import {
  assertCanCreateCompleteSystem,
  assertLicenseAllowsSystemCount,
  checkCreateCompleteSystem,
  LicenseLimitError
} from '../gate'
import { getLicenseStatus } from '../status'

const SECRET = 'test-license-signing-secret-do-not-use-in-prod'
const dirs: string[] = []
const originalMode = process.env.MAIN_VITE_LICENSE_MODE
const originalSecret = process.env.LICENSE_SIGNING_SECRET
const originalSeed = process.env.MAIN_VITE_SEED_DEMO

beforeEach(() => {
  process.env.MAIN_VITE_LICENSE_MODE = 'enforced'
  process.env.LICENSE_SIGNING_SECRET = SECRET
  process.env.MAIN_VITE_SEED_DEMO = 'false'
  closeDatabase()
})

afterEach(() => {
  closeDatabase()
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
  if (originalMode === undefined) delete process.env.MAIN_VITE_LICENSE_MODE
  else process.env.MAIN_VITE_LICENSE_MODE = originalMode
  if (originalSecret === undefined) delete process.env.LICENSE_SIGNING_SECRET
  else process.env.LICENSE_SIGNING_SECRET = originalSecret
  if (originalSeed === undefined) delete process.env.MAIN_VITE_SEED_DEMO
  else process.env.MAIN_VITE_SEED_DEMO = originalSeed
})

function setup(): { userData: string; storeOpts: { userDataPath: string; filePath: string } } {
  const userData = mkdtempSync(join(tmpdir(), 'materiel-license-'))
  dirs.push(userData)
  openDatabase({
    path: join(userData, 'test.db'),
    key: 'test-key-materiel-0001',
    seedDemo: false,
    allowEnvKey: false,
    safeStorage: null
  })
  const storeOpts = { userDataPath: userData, filePath: join(userData, 'license.dat') }
  clearLicense(storeOpts)
  return { userData, storeOpts }
}

function insertSystems(count: number): void {
  const db = requireDatabase().db
  const createdAt = '2026-01-01T00:00:00.000Z'
  const insertPart = db.prepare(
    `INSERT INTO parts (
      id, manufacturer, value, type, status, model, serial_number,
      total_round_count, rounds_after_cleaning, maintenance_interval,
      caliber, gunsmith, twist_rate, barrel_life, created_at, updated_at
    ) VALUES (
      @id, 'Acme', 100, @type, 'In Stock', 'M1', @serial,
      0, 0, 500, @caliber, @gunsmith, @twist, @life, @createdAt, @createdAt
    )`
  )

  for (let i = 0; i < count; i++) {
    const actionId = `action-${i}`
    const barrelId = `barrel-${i}`
    const chassisId = `chassis-${i}`
    insertPart.run({
      id: actionId,
      type: 'Action',
      serial: `S${i}`,
      caliber: null,
      gunsmith: null,
      twist: null,
      life: null,
      createdAt
    })
    insertPart.run({
      id: barrelId,
      type: 'Barrel',
      serial: null,
      caliber: '6.5 Creedmoor',
      gunsmith: 'Shop',
      twist: 8,
      life: 3000,
      createdAt
    })
    insertPart.run({
      id: chassisId,
      type: 'Chassis',
      serial: null,
      caliber: null,
      gunsmith: null,
      twist: null,
      life: null,
      createdAt
    })
    createCustomSystem(db, {
      id: `sys-${i}`,
      name: `Rifle ${i}`,
      actionId,
      barrelId,
      chassisId
    })
  }
}

test('free tier allows create when under limit', () => {
  const { storeOpts } = setup()
  insertSystems(1)
  const status = getLicenseStatus(storeOpts)
  assert.equal(status.tier, 'free')
  assert.equal(status.completeRifleCount, 1)
  assert.equal(status.canCreateRifle, true)
  assert.equal(checkCreateCompleteSystem(storeOpts).ok, true)
})

test('free tier blocks third complete system', () => {
  const { storeOpts } = setup()
  insertSystems(2)
  const status = getLicenseStatus(storeOpts)
  assert.equal(status.completeRifleCount, 2)
  assert.equal(status.canCreateRifle, false)
  assert.match(status.blockReason ?? '', /Free tier allows up to 2/)

  const check = checkCreateCompleteSystem(storeOpts)
  assert.equal(check.ok, false)
  if (!check.ok) {
    assert.equal(check.error.code, 'LICENSE_RIFLE_LIMIT')
  }

  assert.throws(
    () => assertCanCreateCompleteSystem(storeOpts),
    (err: unknown) => err instanceof LicenseLimitError
  )
})

test('unlocked mode always allows create', () => {
  process.env.MAIN_VITE_LICENSE_MODE = 'unlocked'
  const { storeOpts } = setup()
  insertSystems(5)
  const status = getLicenseStatus(storeOpts)
  assert.equal(status.mode, 'unlocked')
  assert.equal(status.canCreateRifle, true)
  assert.equal(status.blockReason, null)
})

test('paid activation unlocks beyond free tier', () => {
  const { storeOpts } = setup()
  insertSystems(2)

  const before = getLicenseStatus(storeOpts)
  assert.equal(before.canCreateRifle, false)

  const key = issueLicenseKey('shooter@example.com', SECRET)
  const result = activateLicense(
    { email: 'shooter@example.com', key, username: 'shooter' },
    storeOpts
  )
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.license.tier, 'paid')
    assert.equal(result.license.canCreateRifle, true)
    assert.equal(result.license.activatedEmail, 'shooter@example.com')
    assert.equal(result.license.activatedUsername, 'shooter')
    assert.equal(result.license.keyPresent, true)
  }

  assert.equal(assertCanCreateCompleteSystem(storeOpts).tier, 'paid')
})

test('activate rejects email mismatch', () => {
  const { storeOpts } = setup()
  const key = issueLicenseKey('a@example.com', SECRET)
  const result = activateLicense({ email: 'b@example.com', key, username: 'shooter' }, storeOpts)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, 'LICENSE_EMAIL_MISMATCH')
  }
})

test('activate requires username', () => {
  const { storeOpts } = setup()
  const key = issueLicenseKey('shooter@example.com', SECRET)
  const result = activateLicense({ email: 'shooter@example.com', key }, storeOpts)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, 'LICENSE_USERNAME_REQUIRED')
  }
})

test('reinstall recovery: username + key restores paid', () => {
  const { storeOpts } = setup()
  const key = issueLicenseKey('shooter@example.com', SECRET)
  const first = activateLicense(
    { email: 'shooter@example.com', key, username: 'range-day' },
    storeOpts
  )
  assert.equal(first.ok, true)
  clearLicense(storeOpts)

  const restored = activateLicense(
    { email: 'shooter@example.com', key, username: 'range-day' },
    storeOpts
  )
  assert.equal(restored.ok, true)
  if (restored.ok) {
    assert.equal(restored.license.tier, 'paid')
    assert.equal(restored.license.activatedUsername, 'range-day')
  }
})

test('restore gate allows free-tier sized backups and blocks larger', () => {
  const { storeOpts } = setup()

  const ok = assertLicenseAllowsSystemCount(2, storeOpts)
  assert.equal(ok.tier, 'free')

  assert.throws(
    () => assertLicenseAllowsSystemCount(3, storeOpts),
    (err: unknown) => err instanceof LicenseLimitError && /restore has 3/.test(err.message)
  )
})
