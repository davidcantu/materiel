import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { LicenseActivateRequest } from '../../shared/license'
import { activateLicense, clearLicense } from './activate'
import { getLicenseStatus } from './status'

export function registerLicenseIpc(): void {
  ipcMain.handle('license:get-status', () => getLicenseStatus())

  ipcMain.handle('license:activate', (_event, request: LicenseActivateRequest) => {
    if (!request || typeof request.email !== 'string' || typeof request.key !== 'string') {
      return {
        ok: false,
        code: 'LICENSE_INVALID_KEY',
        message: 'Email and license key are required.',
        license: getLicenseStatus()
      }
    }
    return activateLicense({
      email: request.email,
      key: request.key
    })
  })

  ipcMain.handle('license:clear', async (event) => {
    const parent =
      BrowserWindow.fromWebContents(event.sender) ??
      BrowserWindow.getFocusedWindow() ??
      BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())

    const boxOptions: Electron.MessageBoxOptions = {
      type: 'warning',
      title: 'Clear license?',
      message: 'Remove the paid license from this device?',
      detail: 'You will return to free-tier limits. This does not delete inventory data.',
      buttons: ['Cancel', 'Clear license'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    }

    const result = parent
      ? await dialog.showMessageBox(parent, boxOptions)
      : await dialog.showMessageBox(boxOptions)

    if (result.response !== 1) {
      return getLicenseStatus()
    }

    return clearLicense()
  })
}
