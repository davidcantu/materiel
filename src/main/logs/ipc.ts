/**
 * Shooting logs IPC.
 */

import { ipcMain } from 'electron'
import {
  addShootingLog,
  deleteShootingLog,
  getShootingLog,
  listShootingLogs,
  updateShootingLog
} from '../db/shooting-logs'
import { requireDatabase } from '../db/connection'
import type { NewShootingLogInput, UpdateShootingLogInput } from '../db/types'

export function registerLogsIpc(): void {
  ipcMain.handle('logs:list', () => {
    return listShootingLogs(requireDatabase().db)
  })

  ipcMain.handle('logs:get', (_event, id: string) => {
    return getShootingLog(requireDatabase().db, id)
  })

  ipcMain.handle('logs:add', (_event, input: NewShootingLogInput) => {
    return addShootingLog(requireDatabase().db, input)
  })

  ipcMain.handle('logs:update', (_event, input: UpdateShootingLogInput) => {
    return updateShootingLog(requireDatabase().db, input)
  })

  ipcMain.handle('logs:delete', (_event, id: string) => {
    deleteShootingLog(requireDatabase().db, id)
    return { ok: true as const }
  })
}
