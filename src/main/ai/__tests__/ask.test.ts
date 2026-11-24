import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import type Database from 'better-sqlite3-multiple-ciphers'
import { openTestDatabase } from '../../db/connection'
import { createPart } from '../../db/parts'
import { applyInventorySuggestion, askAssistant } from '../ask'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function setup(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-ask-'))
  dirs.push(dir)
  return openTestDatabase(join(dir, 'test.db'))
}

test('askAssistant rejects empty prompts without calling a provider', async () => {
  const db = setup()
  const result = await askAssistant(db, { prompt: '   ' })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.error, /question|prompt/i)
  }
})

test('askAssistant reports missing key when prefs have no encrypted key', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-ask-prefs-'))
  dirs.push(dir)
  const db = openTestDatabase(join(dir, 'test.db'))
  const result = await askAssistant(
    db,
    { prompt: 'What should I train next?' },
    {
      userDataPath: dir,
      prefsPath: join(dir, 'ai-prefs.json'),
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value: string) => Buffer.from(value, 'utf8'),
        decryptString: (buf: Buffer) => buf.toString('utf8')
      },
      isProduction: false
    }
  )
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.error, /API key|Settings|model/i)
  }
})

test('applyInventorySuggestion updates allowed fields only', () => {
  const db = setup()
  const part = createPart(db, {
    manufacturer: 'Proof Research',
    type: 'Barrel',
    name: 'Proof #1',
    caliber: '6.5 Creedmoor',
    gunsmith: 'S&S'
  })

  const rejected = applyInventorySuggestion(db, {
    partId: part.id,
    field: 'serialNumber',
    value: 'ABC-123'
  })
  assert.equal(rejected.ok, false)

  const notes = applyInventorySuggestion(db, {
    partId: part.id,
    field: 'notes',
    value: 'Prefer for windy matches'
  })
  assert.equal(notes.ok, true)

  const life = applyInventorySuggestion(db, {
    partId: part.id,
    field: 'barrelLife',
    value: '2500'
  })
  assert.equal(life.ok, true)

  const muzzle = applyInventorySuggestion(db, {
    partId: part.id,
    field: 'muzzleType',
    value: 'Nope'
  })
  assert.equal(muzzle.ok, false)
})
