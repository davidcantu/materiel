/**
 * Unlock passphrase IPC — available before the DB opens when required.
 */

import { app, ipcMain, safeStorage } from 'electron'
import {
  UNLOCK_MIN_LENGTH,
  type UnlockAttemptInput,
  type UnlockAttemptResult,
  type UnlockChangeInput,
  type UnlockDisableInput,
  type UnlockEnableInput,
  type UnlockStatusInfo
} from '../../shared/unlock'
import { getDatabase, getDatabasePath, requireDatabase, updateProfile } from '../db'
import {
  changeUnlockPassphrase,
  disableUnlock,
  enableUnlock,
  isUnlockRequired,
  type UnlockDeps,
  unlockWithPassphrase
} from '../db/unlock'

export type UnlockBootstrap = {
  /** Open DB + register the rest of the app after a successful cold unlock. */
  onUnlockedWithKey: (key: Buffer) => void
  /** Whether finishBoot already ran this session. */
  isBooted: () => boolean
}

function deps(): UnlockDeps {
  return {
    userDataPath: app.getPath('userData'),
    dbPath: getDatabasePath(),
    safeStorage: safeStorage.isEncryptionAvailable() ? safeStorage : null
  }
}

export function getUnlockStatusInfo(booted: boolean): UnlockStatusInfo {
  return {
    required: isUnlockRequired(deps()),
    unlocked: booted && Boolean(getDatabase()?.ready),
    minLength: UNLOCK_MIN_LENGTH
  }
}

export function registerUnlockIpc(bootstrap: UnlockBootstrap): void {
  ipcMain.handle('unlock:getStatus', (): UnlockStatusInfo => {
    return getUnlockStatusInfo(bootstrap.isBooted())
  })

  ipcMain.handle(
    'unlock:attempt',
    (_event, input: UnlockAttemptInput): UnlockAttemptResult => {
      try {
        if (bootstrap.isBooted() && getDatabase()?.ready) {
          return { ok: true }
        }
        const key = unlockWithPassphrase(input?.passphrase ?? '', deps())
        bootstrap.onUnlockedWithKey(key)
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Unlock failed.'
        }
      }
    }
  )

  ipcMain.handle('unlock:enable', (_event, input: UnlockEnableInput) => {
    const handle = requireDatabase()
    enableUnlock(input.passphrase, input.confirm, handle.keyMaterial, deps())
    updateProfile(handle.db, { unlockPinSet: true })
    return getUnlockStatusInfo(true)
  })

  ipcMain.handle('unlock:change', (_event, input: UnlockChangeInput) => {
    changeUnlockPassphrase(
      input.currentPassphrase,
      input.nextPassphrase,
      input.confirm,
      deps()
    )
    return getUnlockStatusInfo(true)
  })

  ipcMain.handle('unlock:disable', (_event, input: UnlockDisableInput) => {
    const handle = requireDatabase()
    disableUnlock(input.passphrase, deps())
    updateProfile(handle.db, { unlockPinSet: false })
    return getUnlockStatusInfo(true)
  })
}
