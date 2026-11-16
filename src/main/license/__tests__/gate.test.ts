import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { closeDatabase, openDatabase, requireDatabase } from '../../db/connection'
import { createCustomSystem, createFactorySystem } from '../../db/systems'
import { activateLicense, clearLicense } from '../activate'
import { issueLicenseKey } from '../crypto'
import {
  assertCanCreateCompleteSystem,
  assertLicenseAllowsPlatformCounts,
  assertLicenseAllowsSystemCount,
  checkCreateCompleteSystem,
  LicenseLimitError
} from '../gate'
import { getLicenseStatus } from '../status'
import type { Platform } from '../../../shared/platforms'

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

function insertBoltSystems(count: number): void {
  const db = requireDatabase().db
  const createdAt = '2026-01-01T00:00:00.000Z'
  const insertPart = db.prepare(
    `INSERT INTO parts (
      id, manufacturer, value, type, status, platforms, model, serial_number,
      total_round_count, rounds_after_cleaning, maintenance_interval,
      caliber, gunsmith, twist_rate, barrel_life, created_at, updated_at
    ) VALUES (
      @id, 'Acme', 100, @type, 'In Stock', '["bolt_action"]', 'M1', @serial,
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
      id: `sys-bolt-${i}`,
      name: `Rifle ${i}`,
      platform: 'bolt_action',
      actionId,
      barrelId,
      chassisId
    })
  }
}

function insertFactorySystems(platform: Platform, count: number, prefix: string): void {
  const db = requireDatabase().db
  for (let i = 0; i < count; i++) {
    createFactorySystem(db, {
      id: `sys-${prefix}-${i}`,
      name: `${prefix} ${i}`,
      platform,
      factoryManufacturer: 'Acme',
      factoryModel: `Model-${i}`,
      factoryCartridge: platform === 'pistol' ? '9mm' : '5.56 NATO'
    })
  }
}

test('free tier allows create when under per-platform limit', () => {
  const { storeOpts } = setup()
  insertBoltSystems(1)
  const status = getLicenseStatus(storeOpts)
  assert.equal(status.tier, 'free')
  assert.equal(status.completeRifleCount, 1)
  assert.equal(status.countsByPlatform.bolt_action, 1)
  assert.equal(status.countsByPlatform.pistol, 0)
  assert.equal(status.canCreateRifle, true)
  assert.equal(checkCreateCompleteSystem({ ...storeOpts, platform: 'bolt_action' }).ok, true)
})

test('free tier blocks third bolt but still allows pistol/AR', () => {
  const { storeOpts } = setup()
  insertBoltSystems(2)
  const status = getLicenseStatus(storeOpts)
  assert.equal(status.completeRifleCount, 2)
  assert.equal(status.countsByPlatform.bolt_action, 2)
  assert.equal(status.canCreateRifle, true)

  const boltBlocked = checkCreateCompleteSystem({ ...storeOpts, platform: 'bolt_action' })
  assert.equal(boltBlocked.ok, false)
  if (!boltBlocked.ok) {
    assert.equal(boltBlocked.error.code, 'LICENSE_RIFLE_LIMIT')
    assert.match(boltBlocked.error.message, /Bolt Action/)
  }

  assert.equal(checkCreateCompleteSystem({ ...storeOpts, platform: 'pistol' }).ok, true)
  assert.equal(checkCreateCompleteSystem({ ...storeOpts, platform: 'ar_pattern' }).ok, true)

  assert.throws(
    () => assertCanCreateCompleteSystem({ ...storeOpts, platform: 'bolt_action' }),
    (err: unknown) => err instanceof LicenseLimitError
  )
})

test('mixing platforms within 2-each caps stays free', () => {
  const { storeOpts } = setup()
  insertBoltSystems(2)
  insertFactorySystems('pistol', 2, 'pistol')
  insertFactorySystems('ar_pattern', 2, 'ar')

  const status = getLicenseStatus(storeOpts)
  assert.equal(status.completeRifleCount, 6)
  assert.deepEqual(status.countsByPlatform, {
    bolt_action: 2,
    ar_pattern: 2,
    pistol: 2
  })
  assert.equal(status.canCreateRifle, false)
  assert.match(status.blockReason ?? '', /per platform/)

  assert.equal(checkCreateCompleteSystem({ ...storeOpts, platform: 'bolt_action' }).ok, false)
  assert.equal(checkCreateCompleteSystem({ ...storeOpts, platform: 'pistol' }).ok, false)
  assert.equal(checkCreateCompleteSystem({ ...storeOpts, platform: 'ar_pattern' }).ok, false)
})

test('unlocked mode always allows create', () => {
  process.env.MAIN_VITE_LICENSE_MODE = 'unlocked'
  const { storeOpts } = setup()
  insertBoltSystems(5)
  const status = getLicenseStatus(storeOpts)
  assert.equal(status.mode, 'unlocked')
  assert.equal(status.canCreateRifle, true)
  assert.equal(status.blockReason, null)
})

test('paid activation unlocks beyond free tier', () => {
  const { storeOpts } = setup()
  insertBoltSystems(2)

  const before = checkCreateCompleteSystem({ ...storeOpts, platform: 'bolt_action' })
  assert.equal(before.ok, false)

  const key = issueLicenseKey('shooter@example.com', SECRET)
  const result = activateLicense({ email: 'shooter@example.com', key }, storeOpts)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.license.tier, 'paid')
    assert.equal(result.license.canCreateRifle, true)
    assert.equal(result.license.activatedEmail, 'shooter@example.com')
    assert.equal(result.license.activatedUsername, 'shooter@example.com')
    assert.equal(result.license.keyPresent, true)
  }

  assert.equal(
    assertCanCreateCompleteSystem({ ...storeOpts, platform: 'bolt_action' }).tier,
    'paid'
  )
})

test('activate rejects email mismatch', () => {
  const { storeOpts } = setup()
  const key = issueLicenseKey('a@example.com', SECRET)
  const result = activateLicense({ email: 'b@example.com', key }, storeOpts)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, 'LICENSE_EMAIL_MISMATCH')
  }
})

test('activate requires a valid email shape', () => {
  const { storeOpts } = setup()
  const key = issueLicenseKey('shooter@example.com', SECRET)
  const result = activateLicense({ email: 'not-an-email', key }, storeOpts)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, 'LICENSE_INVALID_KEY')
  }
})

test('reinstall recovery: email + key restores paid', () => {
  const { storeOpts } = setup()
  const key = issueLicenseKey('shooter@example.com', SECRET)
  const first = activateLicense({ email: 'shooter@example.com', key }, storeOpts)
  assert.equal(first.ok, true)
  clearLicense(storeOpts)

  const restored = activateLicense({ email: 'shooter@example.com', key }, storeOpts)
  assert.equal(restored.ok, true)
  if (restored.ok) {
    assert.equal(restored.license.tier, 'paid')
    assert.equal(restored.license.activatedEmail, 'shooter@example.com')
    assert.equal(restored.license.activatedUsername, 'shooter@example.com')
  }
})

test('restore gate allows mixed free-tier backups and blocks over-cap platforms', () => {
  const { storeOpts } = setup()

  const ok = assertLicenseAllowsPlatformCounts(
    { bolt_action: 2, ar_pattern: 2, pistol: 2 },
    storeOpts
  )
  assert.equal(ok.tier, 'free')
  assert.equal(ok.completeRifleCount, 6)

  assert.throws(
    () =>
      assertLicenseAllowsPlatformCounts({ bolt_action: 3, ar_pattern: 0, pistol: 0 }, storeOpts),
    (err: unknown) => err instanceof LicenseLimitError && /exceed/i.test(err.message)
  )

  // Bare total is conservative (treated as one platform).
  const okTotal = assertLicenseAllowsSystemCount(2, storeOpts)
  assert.equal(okTotal.tier, 'free')
  assert.throws(
    () => assertLicenseAllowsSystemCount(3, storeOpts),
    (err: unknown) => err instanceof LicenseLimitError && /restore has 3/.test(err.message)
  )
})
