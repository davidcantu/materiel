import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'path'
import { afterEach, test } from 'node:test'
import { randomBytes } from 'crypto'
import {
  changeUnlockPassphrase,
  disableUnlock,
  enableUnlock,
  isUnlockRequired,
  unlockWithPassphrase
} from '../unlock'
import { getDefaultKeyFilePath } from '../key'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setupDeps(): {
  deps: { userDataPath: string; dbPath: string; safeStorage: null }
  dbKey: Buffer
} {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-unlock-'))
  dirs.push(dir)
  const dbPath = join(dir, 'materiel.db')
  return {
    deps: { userDataPath: dir, dbPath, safeStorage: null },
    dbKey: randomBytes(32)
  }
}

test('enable / unlock / wrong passphrase / change / disable', () => {
  const { deps, dbKey } = setupDeps()
  assert.equal(isUnlockRequired(deps), false)

  enableUnlock('correct-horse', 'correct-horse', dbKey, deps)
  assert.equal(isUnlockRequired(deps), true)
  assert.equal(existsSync(getDefaultKeyFilePath(deps.dbPath)), false)
  assert.equal(existsSync(`${getDefaultKeyFilePath(deps.dbPath)}.dev`), false)

  const unlocked = unlockWithPassphrase('correct-horse', deps)
  assert.equal(unlocked.equals(dbKey), true)

  assert.throws(() => unlockWithPassphrase('wrong-pass', deps), /Incorrect passphrase/)

  changeUnlockPassphrase('correct-horse', 'new-passphrase', 'new-passphrase', deps)
  const again = unlockWithPassphrase('new-passphrase', deps)
  assert.equal(again.equals(dbKey), true)

  disableUnlock('new-passphrase', deps)
  assert.equal(isUnlockRequired(deps), false)
  assert.equal(existsSync(`${getDefaultKeyFilePath(deps.dbPath)}.dev`), true)
})

test('enable rejects short or mismatched passphrases', () => {
  const { deps, dbKey } = setupDeps()
  assert.throws(() => enableUnlock('short', 'short', dbKey, deps), /at least/i)
  assert.throws(
    () => enableUnlock('long-enough-pass', 'different-pass', dbKey, deps),
    /confirmation/i
  )
})
