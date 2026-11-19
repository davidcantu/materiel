/**
 * AI BYOK IPC — keys never leave the main process after save.
 */

import { ipcMain } from 'electron'
import type {
  AiProviderId,
  AiSaveKeyInput,
  AiSetModelInput,
  AiStatusInfo
} from '../../shared/ai'
import { AI_PROVIDER_IDS } from '../../shared/ai'
import {
  getAiStatus,
  listAiModels,
  removeAiKey,
  saveAiKey,
  setAiModel,
  testAiConnection
} from './service'
import { mapUnknownError } from './errors'

function asProvider(value: unknown): AiProviderId | undefined {
  if (typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value)) {
    return value as AiProviderId
  }
  return undefined
}

export function registerAiIpc(): void {
  ipcMain.handle(
    'ai:getStatus',
    (_event, payload?: { provider?: AiProviderId; rememberProvider?: boolean }): AiStatusInfo => {
      const provider = asProvider(payload?.provider)
      return getAiStatus(provider, undefined, {
        rememberProvider: Boolean(payload?.rememberProvider && provider)
      })
    }
  )

  ipcMain.handle('ai:saveKey', (_event, input: AiSaveKeyInput): AiStatusInfo => {
    try {
      return saveAiKey(input)
    } catch (error) {
      throw new Error(mapUnknownError(error, input?.apiKey))
    }
  })

  ipcMain.handle(
    'ai:removeKey',
    (_event, payload?: { provider?: AiProviderId }): AiStatusInfo => {
      return removeAiKey(asProvider(payload?.provider))
    }
  )

  ipcMain.handle(
    'ai:listModels',
    async (_event, payload?: { provider?: AiProviderId }) => {
      return listAiModels(asProvider(payload?.provider))
    }
  )

  ipcMain.handle(
    'ai:testConnection',
    async (_event, payload?: { provider?: AiProviderId }) => {
      return testAiConnection(asProvider(payload?.provider))
    }
  )

  ipcMain.handle('ai:setModel', (_event, input: AiSetModelInput): AiStatusInfo => {
    return setAiModel(input)
  })
}
