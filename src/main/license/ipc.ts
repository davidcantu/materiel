import { ipcMain } from 'electron'
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
    return activateLicense({ email: request.email, key: request.key })
  })

  ipcMain.handle('license:clear', () => clearLicense())
}
