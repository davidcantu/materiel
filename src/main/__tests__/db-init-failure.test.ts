import assert from 'node:assert/strict'
import { test } from 'node:test'
import { promptDatabaseInitFailure } from '../db-init-failure'
import type { DatabaseInitFailure } from '../db/init-error'

test('promptDatabaseInitFailure quits on primary button and never claims wipe', async () => {
  const failure: DatabaseInitFailure = {
    message: 'Materiel could not upgrade its local database.',
    detail: 'FOREIGN KEY constraint failed',
    dbPath: '/Users/david/Library/Application Support/Materiel/materiel.db',
    backupDir: '/Users/david/Library/Application Support/Materiel-db-backup-1'
  }

  const calls: Electron.MessageBoxOptions[] = []
  let quitCount = 0

  const action = await promptDatabaseInitFailure(failure, {
    resolveParent: () => null,
    showMessageBox: (async (_opts: unknown, maybeOpts?: unknown) => {
      const opts = (maybeOpts ?? _opts) as Electron.MessageBoxOptions
      calls.push(opts)
      return { response: 0, checkboxChecked: false }
    }) as typeof import('electron').dialog.showMessageBox,
    quitApp: () => {
      quitCount += 1
    }
  })

  assert.equal(action, 'quit')
  assert.equal(quitCount, 1)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].type, 'error')
  assert.deepEqual(calls[0].buttons, ['Quit', 'How to view logs'])
  assert.match(String(calls[0].detail), /not deleted/i)
  assert.match(String(calls[0].detail), /Materiel-db-backup-1/)
  assert.doesNotMatch(String(calls[0].detail), /wiped|erased|removed your data/i)
})

test('promptDatabaseInitFailure shows log guidance then quits', async () => {
  const failure: DatabaseInitFailure = {
    message: 'open failed',
    detail: 'disk error',
    dbPath: '/tmp/materiel.db',
    backupDir: null
  }

  const responses = [1, 0]
  const titles: string[] = []
  let quitCount = 0

  const action = await promptDatabaseInitFailure(failure, {
    resolveParent: () => null,
    showMessageBox: (async (_opts: unknown, maybeOpts?: unknown) => {
      const opts = (maybeOpts ?? _opts) as Electron.MessageBoxOptions
      titles.push(String(opts.title))
      return { response: responses.shift() ?? 0, checkboxChecked: false }
    }) as typeof import('electron').dialog.showMessageBox,
    quitApp: () => {
      quitCount += 1
    }
  })

  assert.equal(action, 'quit')
  assert.equal(quitCount, 1)
  // Help returns to the error dialog, then Quit.
  assert.deepEqual(titles, [
    'Materiel — database error',
    'Materiel — Console logs',
    'Materiel — database error'
  ])
})
