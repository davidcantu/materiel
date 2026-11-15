/**
 * Ammo inventory + load development IPC (software-spec §6.5 / §7.3).
 */

import { ipcMain } from 'electron'
import {
  createAmmoInventory,
  deleteAmmoInventory,
  getAmmoInventory,
  listAmmoInventory,
  moveAmmoToPractice,
  updateAmmoInventory,
  type NewAmmoInput,
  type UpdateAmmoInput
} from '../db/ammo'
import {
  createLoad,
  deleteLoad,
  getLoad,
  listLoads,
  updateLoad,
  type NewLoadInput,
  type UpdateLoadInput
} from '../db/loads'
import { requireDatabase } from '../db/connection'

export function registerAmmoIpc(): void {
  ipcMain.handle('ammo:list', () => {
    return listAmmoInventory(requireDatabase().db)
  })

  ipcMain.handle('ammo:get', (_event, id: string) => {
    return getAmmoInventory(requireDatabase().db, id)
  })

  ipcMain.handle('ammo:create', (_event, input: NewAmmoInput) => {
    return createAmmoInventory(requireDatabase().db, input)
  })

  ipcMain.handle('ammo:update', (_event, id: string, patch: UpdateAmmoInput) => {
    return updateAmmoInventory(requireDatabase().db, id, patch)
  })

  ipcMain.handle('ammo:delete', (_event, id: string) => {
    deleteAmmoInventory(requireDatabase().db, id)
    return { ok: true as const }
  })

  ipcMain.handle('ammo:move-to-practice', (_event, id: string) => {
    return moveAmmoToPractice(requireDatabase().db, id)
  })

  ipcMain.handle('loads:list', () => {
    return listLoads(requireDatabase().db)
  })

  ipcMain.handle('loads:get', (_event, id: string) => {
    return getLoad(requireDatabase().db, id)
  })

  ipcMain.handle('loads:create', (_event, input: NewLoadInput) => {
    return createLoad(requireDatabase().db, input)
  })

  ipcMain.handle('loads:update', (_event, id: string, patch: UpdateLoadInput) => {
    return updateLoad(requireDatabase().db, id, patch)
  })

  ipcMain.handle('loads:delete', (_event, id: string) => {
    deleteLoad(requireDatabase().db, id)
    return { ok: true as const }
  })
}
