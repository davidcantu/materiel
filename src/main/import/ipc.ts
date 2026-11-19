/**
 * JSON import IPC — pick a file or apply an in-memory document.
 */

import { dialog, ipcMain } from 'electron'
import { readFile } from 'fs/promises'
import type { MaterielImportDocument, MaterielImportResult } from '../../shared/import'
import { requireDatabase } from '../db/connection'
import { importMaterielDocument } from '../db/import-data'

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('Selected file is not valid JSON')
  }
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
}
