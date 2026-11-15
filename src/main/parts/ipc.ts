/**
 * Parts inventory + local profile IPC.
 */

import { ipcMain } from 'electron'
import {
  createPart,
  deletePart,
  getPart,
  listParts,
  resetPartMaintenance,
  setPartStatus,
  updatePart,
  type ListPartsOptions,
  type NewPartInput,
  type UpdatePartInput
} from '../db/parts'
import { ensureLocalProfile, updateProfile, type ProfilePatch } from '../db/profile'
import { getMilestonesSummary } from '../db/milestones'
import { requireDatabase } from '../db/connection'
import type { PartStatus } from '../db/types'

export function registerPartsIpc(): void {
  ipcMain.handle('parts:list', (_event, filter?: ListPartsOptions) => {
    return listParts(requireDatabase().db, filter ?? {})
  })

  ipcMain.handle('parts:get', (_event, id: string) => {
    return getPart(requireDatabase().db, id)
  })

  ipcMain.handle('parts:create', (_event, input: NewPartInput) => {
    return createPart(requireDatabase().db, input)
  })

  ipcMain.handle('parts:update', (_event, id: string, patch: UpdatePartInput) => {
    return updatePart(requireDatabase().db, id, patch)
  })

  ipcMain.handle('parts:delete', (_event, id: string) => {
    deletePart(requireDatabase().db, id)
    return { ok: true as const }
  })

  ipcMain.handle('parts:set-status', (_event, id: string, status: PartStatus) => {
    return setPartStatus(requireDatabase().db, id, status)
  })

  ipcMain.handle('parts:reset-maintenance', (_event, id: string) => {
    return resetPartMaintenance(requireDatabase().db, id)
  })

  ipcMain.handle('profile:get', () => {
    return ensureLocalProfile(requireDatabase().db)
  })

  ipcMain.handle('profile:update', (_event, patch: ProfilePatch) => {
    return updateProfile(requireDatabase().db, patch ?? {})
  })

  ipcMain.handle('milestones:get', () => {
    return getMilestonesSummary(requireDatabase().db)
  })
}
