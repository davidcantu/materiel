/**
 * Dashboard IPC.
 */

import { ipcMain } from 'electron'
import { requireDatabase } from '../db/connection'
import { getDashboardSummary } from '../db/dashboard'

export function registerDashboardIpc(): void {
  ipcMain.handle('dashboard:get', () => {
    return getDashboardSummary(requireDatabase().db)
  })
}
