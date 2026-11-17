import { BrowserWindow, dialog } from 'electron'
import type { UpdateAvailable } from '../../shared/updates'
import { safeOpenExternal } from '../security/open-external'

export type PromptUpdateOptions = {
  /** Prefer showing over this window when still alive. */
  parent?: BrowserWindow | null
  openExternal?: (url: string) => Promise<void>
  showMessageBox?: typeof dialog.showMessageBox
}

/**
 * Native dialog: Update opens the release/download page; Later dismisses.
 * Returns true when the user chose Update.
 */
export async function promptUpdateAvailable(
  update: UpdateAvailable,
  options?: PromptUpdateOptions
): Promise<boolean> {
  const showMessageBox = options?.showMessageBox ?? dialog.showMessageBox.bind(dialog)
  const openExternal = options?.openExternal ?? ((url: string) => safeOpenExternal(url))

  const parent =
    options?.parent && !options.parent.isDestroyed()
      ? options.parent
      : (BrowserWindow.getFocusedWindow() ??
        BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()))

  const title = 'Update available'
  const nameBit = update.releaseName ? ` (${update.releaseName})` : ''
  const message = `Materiel ${update.latestVersion}${nameBit} is available.`
  const detail = [
    `You are running ${update.currentVersion}.`,
    '',
    'What to expect:',
    '1. Open the GitHub Releases page and download the installer for your OS.',
    '2. Quit Materiel, then run the installer (macOS: Open Anyway if Gatekeeper warns).',
    '3. Relaunch Materiel — your local encrypted data stays on this machine.',
    '',
    'Updates are soft-checked against GitHub Releases; nothing installs automatically.'
  ].join('\n')

  const boxOptions: Electron.MessageBoxOptions = {
    type: 'info',
    title,
    message,
    detail,
    buttons: ['Update', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  }

  const result = parent
    ? await showMessageBox(parent, boxOptions)
    : await showMessageBox(boxOptions)

  if (result.response !== 0) {
    return false
  }

  try {
    await openExternal(update.releaseUrl)
  } catch (error) {
    console.warn('[updates] could not open release URL:', error)
  }
  return true
}
