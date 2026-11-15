/**
 * Complete-system IPC — create paths are license-gated.
 */

import { ipcMain } from 'electron'
import type { CustomSystemInput, FactorySystemInput } from '../db/types'
import {
  createCustomSystem,
  createFactorySystem,
  countCompleteSystems,
  deleteSystem,
  getSystem,
  listSystems,
  updateSystem
} from '../db/systems'
import { requireDatabase } from '../db/connection'
import { checkCreateCompleteSystem, LicenseLimitError } from '../license/gate'
import { assertLicenseAllowsSystemCount } from '../license/gate'
import { getLicenseStatus } from '../license/status'

export function registerSystemsIpc(): void {
  ipcMain.handle('systems:count', () => countCompleteSystems(requireDatabase().db))

  ipcMain.handle('systems:list', () => listSystems(requireDatabase().db))

  ipcMain.handle('systems:get', (_event, id: string) => getSystem(requireDatabase().db, id))

  ipcMain.handle('systems:get-license-gate', () => getLicenseStatus())

  ipcMain.handle('systems:create-custom', (_event, input: CustomSystemInput) => {
    const gate = checkCreateCompleteSystem()
    if (!gate.ok) {
      return { ok: false as const, error: gate.error }
    }
    try {
      const system = createCustomSystem(requireDatabase().db, input)
      return { ok: true as const, system }
    } catch (error) {
      if (error instanceof LicenseLimitError) {
        return { ok: false as const, error: error.toDenial() }
      }
      throw error
    }
  })

  ipcMain.handle('systems:create-factory', (_event, input: FactorySystemInput) => {
    const gate = checkCreateCompleteSystem()
    if (!gate.ok) {
      return { ok: false as const, error: gate.error }
    }
    try {
      const system = createFactorySystem(requireDatabase().db, input)
      return { ok: true as const, system }
    } catch (error) {
      if (error instanceof LicenseLimitError) {
        return { ok: false as const, error: error.toDenial() }
      }
      throw error
    }
  })

  ipcMain.handle(
    'systems:update',
    (
      _event,
      id: string,
      patch: Partial<CustomSystemInput & FactorySystemInput> & { buildType?: 'custom' | 'factory' }
    ) => {
      return updateSystem(requireDatabase().db, id, patch)
    }
  )

  ipcMain.handle('systems:delete', (_event, id: string) => {
    deleteSystem(requireDatabase().db, id)
    return { ok: true as const }
  })

  /**
   * Preflight for restore-from-backup: pass the system count inside the backup blob.
   * Returns the same Result shape as create so the renderer can show one message.
   */
  ipcMain.handle('systems:assert-restore-allowed', (_event, systemCount: number) => {
    const count = typeof systemCount === 'number' && systemCount >= 0 ? systemCount : 0
    try {
      const license = assertLicenseAllowsSystemCount(count)
      return { ok: true as const, license }
    } catch (error) {
      if (error instanceof LicenseLimitError) {
        return { ok: false as const, error: error.toDenial() }
      }
      throw error
    }
  })
}
