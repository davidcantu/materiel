import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { hasLocalUsername, isValidUsername } from '../../../shared/profile'
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

test('isValidUsername rejects empty and oversized values', () => {
  assert.equal(isValidUsername(''), false)
  assert.equal(isValidUsername('a'), false)
  assert.equal(isValidUsername('ab'), true)
  assert.equal(isValidUsername('x'.repeat(65)), false)
  assert.equal(isValidUsername('ok\nname'), false)
})

test('first-run profile starts without username', () => {
  const db = openTestDatabase(tempDbPath())
  try {
    const profile = ensureLocalProfile(db)
    assert.equal(profile.username, '')
    assert.equal(hasLocalUsername(profile), false)

    const updated = updateProfile(db, { username: 'marksman', email: 'm@example.com' })
    assert.equal(updated.username, 'marksman')
    assert.equal(updated.email, 'm@example.com')
    assert.equal(hasLocalUsername(updated), true)
  } finally {
    db.close()
  }
})

test('updateProfile rejects invalid username', () => {
  const db = openTestDatabase(tempDbPath())
  try {
    ensureLocalProfile(db)
    assert.throws(() => updateProfile(db, { username: 'x' }), /Username must be/)
  } finally {
    db.close()
  }
})
