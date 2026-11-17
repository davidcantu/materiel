/**
 * Complete-system IPC — create / list / update / delete (unlimited).
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

export function registerSystemsIpc(): void {
  ipcMain.handle('systems:count', () => countCompleteSystems(requireDatabase().db))

  ipcMain.handle('systems:list', () => listSystems(requireDatabase().db))

  ipcMain.handle('systems:get', (_event, id: string) => getSystem(requireDatabase().db, id))

  ipcMain.handle('systems:create-custom', (_event, input: CustomSystemInput) => {
    return createCustomSystem(requireDatabase().db, input)
  })

  ipcMain.handle('systems:create-factory', (_event, input: FactorySystemInput) => {
    return createFactorySystem(requireDatabase().db, input)
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
}
