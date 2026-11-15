import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  issueLicenseKey,
  normalizeEmail,
  parseLicenseKey,
  validateLicenseKeyFormat,
  verifyLicenseKey
} from '../crypto'

const SECRET = 'test-license-signing-secret-do-not-use-in-prod'

test('issueLicenseKey embeds email and verifies', () => {
  const key = issueLicenseKey('User@Example.COM', SECRET)
  assert.ok(key.startsWith('MAT-1.'))
  assert.equal(validateLicenseKeyFormat(key), true, `format rejected for ${key}`)

  const verified = verifyLicenseKey(key, { secret: SECRET, claimedEmail: 'user@example.com' })
  assert.equal(verified.ok, true)
  if (verified.ok) {
    assert.equal(verified.email, 'user@example.com')
  }
})

test('verifyLicenseKey rejects wrong email claim', () => {
  const key = issueLicenseKey('a@example.com', SECRET)
  const verified = verifyLicenseKey(key, { secret: SECRET, claimedEmail: 'b@example.com' })
  assert.deepEqual(verified, { ok: false, reason: 'email' })
})

test('verifyLicenseKey rejects tampered key', () => {
  const key = issueLicenseKey('a@example.com', SECRET)
  const parsed = parseLicenseKey(key)
  assert.ok(parsed)
  const tampered = `MAT-1.${parsed!.emailB64}.${'A'.repeat(43)}`
  const verified = verifyLicenseKey(tampered, { secret: SECRET })
  assert.equal(verified.ok, false)
})

test('verifyLicenseKey rejects wrong secret', () => {
  const key = issueLicenseKey('a@example.com', SECRET)
  const verified = verifyLicenseKey(key, { secret: 'other-secret' })
  assert.deepEqual(verified, { ok: false, reason: 'signature' })
})

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com')
})

test('validateLicenseKeyFormat rejects legacy short stub keys', () => {
  assert.equal(validateLicenseKeyFormat('MAT-XXXX-XXXX-XXXX'), false)
  assert.equal(validateLicenseKeyFormat('not-a-key'), false)
})
