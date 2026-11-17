/**
 * Native dialog + in-window error page when database init fails.
 * Injected showMessageBox / quitApp keep this unit-testable without Electron.
 */

import { BrowserWindow, dialog, app } from 'electron'
import type { DatabaseInitFailure } from './db/init-error'
import { buildDatabaseInitFailureDetail } from './db/init-error'

export type PromptDatabaseInitFailureOptions = {
  parent?: BrowserWindow | null
  showMessageBox?: typeof dialog.showMessageBox
  quitApp?: () => void
  /** Resolve a parent window; injectable so Node unit tests skip Electron. */
  resolveParent?: () => BrowserWindow | null | undefined
}

export type DatabaseInitFailureAction = 'quit' | 'dismissed'

function defaultResolveParent(preferred?: BrowserWindow | null): BrowserWindow | undefined {
  if (preferred && !preferred.isDestroyed()) {
    return preferred
  }
  try {
    return (
      BrowserWindow.getFocusedWindow() ??
      BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    )
  } catch {
    return undefined
  }
}

/**
 * Error dialog: explains data was kept, shows backup path, Quit or log guidance.
 */
export async function promptDatabaseInitFailure(
  failure: DatabaseInitFailure,
  options: PromptDatabaseInitFailureOptions = {}
): Promise<DatabaseInitFailureAction> {
  const showMessageBox = options.showMessageBox ?? dialog.showMessageBox.bind(dialog)
  const quitApp = options.quitApp ?? (() => app.quit())

  const parent = options.resolveParent
    ? (options.resolveParent() ?? undefined)
    : defaultResolveParent(options.parent)

  const boxOptions: Electron.MessageBoxOptions = {
    type: 'error',
    title: 'Materiel — database error',
    message: failure.message,
    detail: buildDatabaseInitFailureDetail(failure),
    buttons: ['Quit', 'How to view logs'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  }

  // Loop so "How to view logs" can return to the same choices.
  for (;;) {
    const result = parent
      ? await showMessageBox(parent, boxOptions)
      : await showMessageBox(boxOptions)

    if (result.response === 1) {
      const helpOptions: Electron.MessageBoxOptions = {
        type: 'info',
        title: 'Materiel — Console logs',
        message: 'How to view Materiel logs',
        detail: [
          'macOS: open Console.app → select your Mac → filter for “Materiel”.',
          '',
          'Or quit and run from Terminal to see errors directly:',
          '/Applications/Materiel.app/Contents/MacOS/Materiel',
          '',
          'Your encrypted database was not deleted.',
          failure.backupDir ? `Backup: ${failure.backupDir}` : ''
        ]
          .filter(Boolean)
          .join('\n'),
        buttons: ['Back'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      }
      if (parent) {
        await showMessageBox(parent, helpOptions)
      } else {
        await showMessageBox(helpOptions)
      }
      continue
    }

    quitApp()
    return 'quit'
  }
}
