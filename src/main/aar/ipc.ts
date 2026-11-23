/**
 * AAR / PPEWS / Trends / COF attachment IPC.
 */

import { dialog, ipcMain } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  aarToMarkdown,
  completeAar,
  computePpewsMismatch,
  createAar,
  deleteAar,
  getAar,
  getAarByLogEntryId,
  listAars,
  reopenAarDraft,
  updateAar,
  upsertPpews,
  validateAarComplete
} from '../db/aar'
import {
  addAttachment,
  aarAttachmentsRoot,
  deleteAttachment,
  getAttachment
} from '../db/aar-attachments'
import { confirmStages, listStagesForAar, replaceStages } from '../db/aar-stages'
import { requireDatabase } from '../db/connection'
import { getPpewsTrends } from '../db/trends'
import type {
  AarPatch,
  AarStageInput,
  CreateAarInput,
  PpewsPatch,
  TrendsFilters
} from '../../shared/aar'
import { isHeicMime, isPdfMime } from '../ai/images'
import { AI_COACH_FEATURE_STATUS } from '../../shared/ai-coach'

export function registerAarIpc(): void {
  ipcMain.handle('aar:list', () => listAars(requireDatabase().db))

  ipcMain.handle('aar:get', (_event, id: string) => getAar(requireDatabase().db, id))

  ipcMain.handle('aar:getByLog', (_event, logEntryId: string) =>
    getAarByLogEntryId(requireDatabase().db, logEntryId)
  )

  ipcMain.handle('aar:create', (_event, input?: CreateAarInput) =>
    createAar(requireDatabase().db, input ?? {})
  )

  ipcMain.handle('aar:update', (_event, id: string, patch: AarPatch) =>
    updateAar(requireDatabase().db, id, patch ?? {})
  )

  ipcMain.handle('aar:upsertPpews', (_event, aarId: string, patches: PpewsPatch[]) =>
    upsertPpews(requireDatabase().db, aarId, patches ?? [])
  )

  ipcMain.handle('aar:complete', (_event, id: string) => completeAar(requireDatabase().db, id))

  ipcMain.handle('aar:reopen', (_event, id: string) => reopenAarDraft(requireDatabase().db, id))

  ipcMain.handle('aar:delete', (_event, id: string) => {
    const db = requireDatabase().db
    const existing = getAar(db, id)
    if (existing) {
      for (const att of existing.attachments) {
        deleteAttachment(db, att.id)
      }
      deleteAar(db, id)
    }
    return { ok: true as const }
  })

  ipcMain.handle('aar:validate', (_event, id: string) => {
    const aar = getAar(requireDatabase().db, id)
    if (!aar) throw new Error(`AAR not found: ${id}`)
    return {
      validation: validateAarComplete(aar),
      mismatch: computePpewsMismatch(aar)
    }
  })

  ipcMain.handle('aar:exportMarkdown', (_event, id: string) => {
    const aar = getAar(requireDatabase().db, id)
    if (!aar) throw new Error(`AAR not found: ${id}`)
    return { markdown: aarToMarkdown(aar) }
  })

  ipcMain.handle('aar:trends', (_event, filters?: TrendsFilters) =>
    getPpewsTrends(requireDatabase().db, filters ?? {})
  )

  ipcMain.handle('aar:listStages', (_event, aarId: string) =>
    listStagesForAar(requireDatabase().db, aarId)
  )

  ipcMain.handle(
    'aar:replaceStages',
    (_event, aarId: string, stages: AarStageInput[]) =>
      replaceStages(requireDatabase().db, aarId, stages ?? [])
  )

  ipcMain.handle(
    'aar:confirmStages',
    (_event, aarId: string, stages: AarStageInput[]) =>
      confirmStages(requireDatabase().db, aarId, stages ?? [])
  )

  ipcMain.handle('aar:pickAttachments', async (_event, aarId: string) => {
    const db = requireDatabase().db
    const aar = getAar(db, aarId)
    if (!aar) throw new Error(`AAR not found: ${aarId}`)

    const result = await dialog.showOpenDialog({
      title: 'Attach course-of-fire images',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'pdf'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { attachments: aar.attachments, skipped: [] as string[] }
    }

    const skipped: string[] = []
    for (const filePath of result.filePaths) {
      const lower = filePath.toLowerCase()
      let mimeType = 'application/octet-stream'
      if (lower.endsWith('.png')) mimeType = 'image/png'
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mimeType = 'image/jpeg'
      else if (lower.endsWith('.heic') || lower.endsWith('.heif')) mimeType = 'image/heic'
      else if (lower.endsWith('.pdf')) mimeType = 'application/pdf'

      const filename = filePath.split(/[/\\]/).pop() ?? 'attachment'
      if (isHeicMime(mimeType, filename)) {
        skipped.push(`${filename}: ${AI_COACH_FEATURE_STATUS.heicUnsupported}`)
        continue
      }
      if (isPdfMime(mimeType, filename)) {
        skipped.push(`${filename}: ${AI_COACH_FEATURE_STATUS.pdfSoftFail}`)
        continue
      }
      if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
        skipped.push(`${filename}: Use JPEG or PNG.`)
        continue
      }

      const bytes = readFileSync(filePath)
      addAttachment(db, {
        aarId,
        sourcePath: filePath,
        mimeType,
        originalFilename: filename,
        contentBytes: bytes
      })
    }

    const next = getAar(db, aarId)!
    return { attachments: next.attachments, skipped, root: aarAttachmentsRoot() }
  })

  ipcMain.handle('aar:deleteAttachment', (_event, id: string) => {
    deleteAttachment(requireDatabase().db, id)
    return { ok: true as const }
  })

  ipcMain.handle('aar:getAttachmentPath', (_event, id: string) => {
    const att = getAttachment(requireDatabase().db, id)
    if (!att) return null
    return {
      id: att.id,
      absolutePath: join(aarAttachmentsRoot(), att.relativePath),
      mimeType: att.mimeType,
      originalFilename: att.originalFilename
    }
  })
}
