import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { test } from 'node:test'
import { getDefaultKeyFilePath, resolveDatabaseKey } from '../key'

const dirs: string[] = []

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'materiel-key-'))
  dirs.push(dir)
  return join(dir, 'materiel.db')
}

test('production refuses plaintext dev-key fallback even with ALLOW_DEV_DB_KEY', () => {
  const dbPath = tempDbPath()
  const prevEnv = process.env.MAIN_VITE_APP_ENV
  const prevAllow = process.env.MAIN_VITE_ALLOW_DEV_DB_KEY
  const prevDbKey = process.env.MATERIEL_DB_KEY
  const prevMainKey = process.env.MAIN_VITE_DB_KEY
  try {
    process.env.MAIN_VITE_APP_ENV = 'production'
    process.env.MAIN_VITE_ALLOW_DEV_DB_KEY = 'true'
    delete process.env.MATERIEL_DB_KEY
    delete process.env.MAIN_VITE_DB_KEY

    assert.throws(
      () =>
        resolveDatabaseKey({
          dbPath,
          allowEnvKey: true,
          safeStorage: null
        }),
      /Production requires Electron safeStorage/
    )
  } finally {
    if (prevEnv === undefined) delete process.env.MAIN_VITE_APP_ENV
    else process.env.MAIN_VITE_APP_ENV = prevEnv
    if (prevAllow === undefined) delete process.env.MAIN_VITE_ALLOW_DEV_DB_KEY
    else process.env.MAIN_VITE_ALLOW_DEV_DB_KEY = prevAllow
    if (prevDbKey === undefined) delete process.env.MATERIEL_DB_KEY
    else process.env.MATERIEL_DB_KEY = prevDbKey
    if (prevMainKey === undefined) delete process.env.MAIN_VITE_DB_KEY
    else process.env.MAIN_VITE_DB_KEY = prevMainKey
  }
})

test('safeStorage key file is written without group/other permissions', () => {
  const dbPath = tempDbPath()
  const prevEnv = process.env.MAIN_VITE_APP_ENV
  try {
    process.env.MAIN_VITE_APP_ENV = 'development'
    const resolved = resolveDatabaseKey({
      dbPath,
      allowEnvKey: false,
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(`enc:${value}`, 'utf8'),
        decryptString: (buf) => {
          const s = buf.toString('utf8')
          assert.ok(s.startsWith('enc:'))
          return s.slice(4)
        }
      }
    })
    assert.equal(resolved.source, 'safeStorage')
    assert.equal(resolved.key.length, 32)

    const mode = statSync(getDefaultKeyFilePath(dbPath)).mode & 0o777
    assert.equal(mode & 0o077, 0)
  } finally {
    if (prevEnv === undefined) delete process.env.MAIN_VITE_APP_ENV
    else process.env.MAIN_VITE_APP_ENV = prevEnv
  }
})

test.after(() => {
  for (const dir of dirs) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
})
