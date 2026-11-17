import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { hasLocalIdentity, isValidEmailIdentity } from '../../../shared/profile'
import { openTestDatabase } from '../connection'
import { ensureLocalProfile, updateProfile } from '../profile'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-profile-'))
  dirs.push(dir)
  return join(dir, 'test.db')
}

test('isValidEmailIdentity rejects empty and malformed values', () => {
  assert.equal(isValidEmailIdentity(''), false)
  assert.equal(isValidEmailIdentity('a'), false)
  assert.equal(isValidEmailIdentity('ab'), false)
  assert.equal(isValidEmailIdentity('not-an-email'), false)
  assert.equal(isValidEmailIdentity('user@local'), false)
  assert.equal(isValidEmailIdentity('shooter@example.com'), true)
})

test('first-run profile starts without identity; email sets username mirror', () => {
  const db = openTestDatabase(tempDbPath())
  try {
    const profile = ensureLocalProfile(db)
    assert.equal(profile.username, '')
    assert.equal(profile.email, null)
    assert.equal(hasLocalIdentity(profile), false)

    const updated = updateProfile(db, { email: 'm@example.com' })
    assert.equal(updated.email, 'm@example.com')
    assert.equal(updated.username, 'm@example.com')
    assert.equal(hasLocalIdentity(updated), true)
  } finally {
    db.close()
  }
})

test('updateProfile rejects invalid email', () => {
  const db = openTestDatabase(tempDbPath())
  try {
    ensureLocalProfile(db)
    assert.throws(() => updateProfile(db, { email: 'x' }), /valid email/)
  } finally {
    db.close()
  }
})

test('legacy username patch that looks like email becomes identity', () => {
  const db = openTestDatabase(tempDbPath())
  try {
    ensureLocalProfile(db)
    const updated = updateProfile(db, { username: 'marksman@example.com' })
    assert.equal(updated.email, 'marksman@example.com')
    assert.equal(updated.username, 'marksman@example.com')
    assert.equal(hasLocalIdentity(updated), true)
  } finally {
    db.close()
  }
})

test('updateProfile stores profile image data URI', () => {
  const db = openTestDatabase(tempDbPath())
  try {
    ensureLocalProfile(db)
    const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD'
    const updated = updateProfile(db, {
      firstName: 'David',
      lastName: 'Cantu',
      email: 'david@example.com',
      city: 'Austin',
      state: 'TX',
      country: 'USA',
      profileImageUrl: dataUri
    })
    assert.equal(updated.firstName, 'David')
    assert.equal(updated.profileImageUrl, dataUri)

    const cleared = updateProfile(db, { profileImageUrl: null })
    assert.equal(cleared.profileImageUrl, null)
    assert.equal(cleared.firstName, 'David')
  } finally {
    db.close()
  }
})

test('updateProfile rejects non-JPEG profile image URLs', () => {
  const db = openTestDatabase(tempDbPath())
  try {
    ensureLocalProfile(db)
    assert.throws(
      () => updateProfile(db, { profileImageUrl: 'https://evil.example/a.png' }),
      /JPEG data URL/
    )
    assert.throws(
      () => updateProfile(db, { profileImageUrl: 'data:image/png;base64,aaaa' }),
      /JPEG data URL/
    )
  } finally {
    db.close()
  }
})
