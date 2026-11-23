/**
 * JSON/Excel import + Excel export / sample template IPC.
 */

import { dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import type { MaterielExportResult } from '../../shared/export'
import type { MaterielImportDocument, MaterielImportResult } from '../../shared/import'
import { requireDatabase } from '../db/connection'
import { materielDocumentFromExcelBuffer } from '../db/excel-import'
import { buildMaterielSampleExcelBuffer } from '../db/excel-template'
import { buildMaterielExcelBuffer } from '../db/export-excel'
import { importMaterielDocument } from '../db/import-data'

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('Selected file is not valid JSON')
  }
}

function defaultExportFileName(): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `Materiel-export-${stamp}.xlsx`
}

function defaultSampleFileName(): string {
  return 'Materiel-import-sample.xlsx'
}

export function registerImportIpc(): void {
  ipcMain.handle('import:from-json', (_event, document: MaterielImportDocument): MaterielImportResult => {
    return importMaterielDocument(requireDatabase().db, document)
  })

  ipcMain.handle('import:pick-json-file', async (): Promise<MaterielImportResult> => {
    const result = await dialog.showOpenDialog({
      title: 'Import Materiel JSON',
      properties: ['openFile'],
      filters: [
        { name: 'Materiel JSON', extensions: ['json'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'Import cancelled' }
    }
    const path = result.filePaths[0]!
    const text = await readFile(path, 'utf8')
    const document = parseJsonText(text)
    return importMaterielDocument(requireDatabase().db, document)
  })

  ipcMain.handle('import:pick-excel-file', async (): Promise<MaterielImportResult> => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Materiel Excel',
        properties: ['openFile'],
        filters: [
          { name: 'Excel workbook', extensions: ['xlsx'] },
          { name: 'All files', extensions: ['*'] }
        ]
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, error: 'Import cancelled' }
      }
      const path = result.filePaths[0]!
      const buffer = await readFile(path)
      const document = await materielDocumentFromExcelBuffer(buffer)
      return importMaterielDocument(requireDatabase().db, document)
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Excel import failed'
      }
    }
  })

  ipcMain.handle('export:excel', async (): Promise<MaterielExportResult> => {
    try {
      const save = await dialog.showSaveDialog({
        title: 'Export Materiel Excel',
        defaultPath: defaultExportFileName(),
        filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }]
      })
      if (save.canceled || !save.filePath) {
        return { ok: false, error: 'Export cancelled' }
      }
      const target = save.filePath.endsWith('.xlsx') ? save.filePath : `${save.filePath}.xlsx`
      const buffer = await buildMaterielExcelBuffer(requireDatabase().db)
      await writeFile(target, buffer)
      return { ok: true, path: target }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Export failed'
      }
    }
  })

  ipcMain.handle('export:sample-excel', async (): Promise<MaterielExportResult> => {
    try {
      const save = await dialog.showSaveDialog({
        title: 'Save Materiel sample Excel',
        defaultPath: defaultSampleFileName(),
        filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }]
      })
      if (save.canceled || !save.filePath) {
        return { ok: false, error: 'Export cancelled' }
      }
      const target = save.filePath.endsWith('.xlsx') ? save.filePath : `${save.filePath}.xlsx`
      const buffer = await buildMaterielSampleExcelBuffer()
      await writeFile(target, buffer)
      return { ok: true, path: target }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Sample download failed'
      }
    }
  })
}
