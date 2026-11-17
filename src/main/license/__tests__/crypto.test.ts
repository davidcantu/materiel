import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { test } from 'node:test'
import {
  getMaterielLicensePublicKey,
  issueLicenseKey,
  normalizeEmail,
  parseLicenseKey,
  validateLicenseKeyFormat,
  verifyLicenseKey
} from '../crypto'

function testKeyPair() {
  return generateKeyPairSync('ed25519')
}

test('issueLicenseKey embeds email and verifies with matching public key', () => {
  const { publicKey, privateKey } = testKeyPair()
  const key = issueLicenseKey('User@Example.COM', privateKey)
  assert.ok(key.startsWith('MAT-1.'))
  assert.equal(validateLicenseKeyFormat(key), true, `format rejected for ${key}`)

  const verified = verifyLicenseKey(key, {
    publicKey,
    claimedEmail: 'user@example.com'
  })
  assert.equal(verified.ok, true)
  if (verified.ok) {
    assert.equal(verified.email, 'user@example.com')
  }
})

test('verifyLicenseKey rejects wrong email claim', () => {
  const { publicKey, privateKey } = testKeyPair()
  const key = issueLicenseKey('a@example.com', privateKey)
  const verified = verifyLicenseKey(key, { publicKey, claimedEmail: 'b@example.com' })
  assert.deepEqual(verified, { ok: false, reason: 'email' })
})

test('verifyLicenseKey rejects tampered key', () => {
  const { publicKey, privateKey } = testKeyPair()
  const key = issueLicenseKey('a@example.com', privateKey)
  const parsed = parseLicenseKey(key)
  assert.ok(parsed)
  const tampered = `MAT-1.${parsed!.emailB64}.${'A'.repeat(86)}`
  const verified = verifyLicenseKey(tampered, { publicKey })
  assert.equal(verified.ok, false)
})

test('verifyLicenseKey rejects signature from a different keypair', () => {
  const issuer = testKeyPair()
  const other = testKeyPair()
  const key = issueLicenseKey('a@example.com', issuer.privateKey)
  const verified = verifyLicenseKey(key, { publicKey: other.publicKey })
  assert.deepEqual(verified, { ok: false, reason: 'signature' })
})

test('embedded public key loads as Ed25519', () => {
  const pub = getMaterielLicensePublicKey()
  assert.equal(pub.asymmetricKeyType, 'ed25519')
})

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com')
})

test('validateLicenseKeyFormat rejects legacy short stub keys', () => {
  assert.equal(validateLicenseKeyFormat('MAT-XXXX-XXXX-XXXX'), false)
  assert.equal(validateLicenseKeyFormat('not-a-key'), false)
})
