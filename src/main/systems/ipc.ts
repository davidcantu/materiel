/**
 * Complete-system IPC — create paths are license-gated.
 */

import { ipcMain } from 'electron'
import type { PlatformSystemCounts } from '../../shared/license'
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
import {
  assertLicenseAllowsPlatformCounts,
  assertLicenseAllowsSystemCount,
  checkCreateCompleteSystem,
  LicenseLimitError
} from '../license/gate'
import { getLicenseStatus } from '../license/status'

export function registerSystemsIpc(): void {
  ipcMain.handle('systems:count', () => countCompleteSystems(requireDatabase().db))

  ipcMain.handle('systems:list', () => listSystems(requireDatabase().db))

  ipcMain.handle('systems:get', (_event, id: string) => getSystem(requireDatabase().db, id))

  ipcMain.handle('systems:get-license-gate', () => getLicenseStatus())

  ipcMain.handle('systems:create-custom', (_event, input: CustomSystemInput) => {
    const gate = checkCreateCompleteSystem({ platform: input.platform })
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
    const gate = checkCreateCompleteSystem({ platform: input.platform })
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
   * Preflight for restore-from-backup.
   * Prefer per-platform counts; a bare number is treated conservatively
   * (all systems on one platform).
   */
  ipcMain.handle(
    'systems:assert-restore-allowed',
    (_event, payload: number | PlatformSystemCounts) => {
      try {
        if (typeof payload === 'number') {
          const count = payload >= 0 ? payload : 0
          const license = assertLicenseAllowsSystemCount(count)
          return { ok: true as const, license }
        }
        const license = assertLicenseAllowsPlatformCounts(payload ?? {})
        return { ok: true as const, license }
      } catch (error) {
        if (error instanceof LicenseLimitError) {
          return { ok: false as const, error: error.toDenial() }
        }
        throw error
      }
    }
  )
}
