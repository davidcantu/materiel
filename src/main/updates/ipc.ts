/**
 * Manual update-check IPC for Settings → Check for updates.
 */

import { ipcMain } from 'electron'
import type { UpdateCheckResult } from '../../shared/updates'
import { promptUpdateAvailable } from './prompt'
import { runUpdateCheck } from './index'

/**
 * Manual check: always return the result to the renderer.
 * When an update is available, also show the native prompt (bypass session dedupe).
 */
export async function checkUpdatesForUi(): Promise<UpdateCheckResult> {
  const result = await runUpdateCheck({ silent: true })

  if (result.status === 'available') {
    await promptUpdateAvailable(result)
  }

  return result
}

export function registerUpdatesIpc(): void {
  ipcMain.handle('updates:check', () => checkUpdatesForUi())
}
