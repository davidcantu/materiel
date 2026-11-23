/**
 * AAR COF attachment metadata (files live under userData/aar-attachments/).
 */

import { createHash, randomUUID } from 'crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { dirname, extname, join } from 'path'
import { app } from 'electron'
import type Database from 'better-sqlite3-multiple-ciphers'
import type { AarAttachment } from '../../shared/aar'

export type AttachmentRow = {
  id: string
  aar_id: string
  relative_path: string
  ai_relative_path: string | null
  content_hash: string | null
  mime_type: string
  page_index: number | null
  original_filename: string | null
  sort_order: number
  created_at: string
}

export type AttachmentStoreDeps = {
  userDataPath?: string
}

function nowIso(): string {
  return new Date().toISOString()
}

export function aarAttachmentsRoot(deps?: AttachmentStoreDeps): string {
  const root = deps?.userDataPath ?? app.getPath('userData')
  const dir = join(root, 'aar-attachments')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function absoluteAttachmentPath(
  relativePath: string,
  deps?: AttachmentStoreDeps
): string {
  return join(aarAttachmentsRoot(deps), relativePath)
}

function mapAttachment(row: AttachmentRow): AarAttachment {
  return {
    id: row.id,
    aarId: row.aar_id,
    relativePath: row.relative_path,
    aiRelativePath: row.ai_relative_path,
    contentHash: row.content_hash,
    mimeType: row.mime_type,
    pageIndex: row.page_index,
    originalFilename: row.original_filename,
    sortOrder: row.sort_order,
    createdAt: row.created_at
  }
}

export function listAttachmentsForAar(db: Database.Database, aarId: string): AarAttachment[] {
  const rows = db
    .prepare(`SELECT * FROM aar_attachment WHERE aar_id = ? ORDER BY sort_order ASC, created_at ASC`)
    .all(aarId) as AttachmentRow[]
  return rows.map(mapAttachment)
}

export function getAttachment(db: Database.Database, id: string): AarAttachment | null {
  const row = db.prepare(`SELECT * FROM aar_attachment WHERE id = ?`).get(id) as
    | AttachmentRow
    | undefined
  return row ? mapAttachment(row) : null
}

export type AddAttachmentInput = {
  aarId: string
  sourcePath: string
  mimeType: string
  originalFilename?: string | null
  pageIndex?: number | null
  /** Precomputed relative path under aar-attachments (optional). */
  relativePath?: string
  aiRelativePath?: string | null
  contentBytes?: Buffer
}

function safeExt(filename: string | null | undefined, mimeType: string): string {
  const fromName = filename ? extname(filename).toLowerCase() : ''
  if (fromName && /^\.[a-z0-9]{1,8}$/.test(fromName)) return fromName
  if (mimeType === 'image/png') return '.png'
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg'
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return '.heic'
  if (mimeType === 'application/pdf') return '.pdf'
  return '.bin'
}

export function addAttachment(
  db: Database.Database,
  input: AddAttachmentInput,
  deps?: AttachmentStoreDeps
): AarAttachment {
  const aar = db.prepare(`SELECT id FROM aar WHERE id = ?`).get(input.aarId) as
    | { id: string }
    | undefined
  if (!aar) throw new Error(`AAR not found: ${input.aarId}`)

  const id = randomUUID()
  const createdAt = nowIso()
  const ext = safeExt(input.originalFilename, input.mimeType)
  const relativePath = input.relativePath ?? join(input.aarId, `${id}${ext}`)
  const abs = absoluteAttachmentPath(relativePath, deps)
  mkdirSync(dirname(abs), { recursive: true })

  let bytes: Buffer
  if (input.contentBytes) {
    writeFileSync(abs, input.contentBytes)
    bytes = input.contentBytes
  } else {
    if (!existsSync(input.sourcePath)) {
      throw new Error(`Attachment source missing: ${input.sourcePath}`)
    }
    copyFileSync(input.sourcePath, abs)
    bytes = readFileSync(abs)
  }

  const contentHash = createHash('sha256').update(bytes).digest('hex')
  const maxOrder = db
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM aar_attachment WHERE aar_id = ?`)
    .get(input.aarId) as { m: number }

  db.prepare(
    `INSERT INTO aar_attachment (
      id, aar_id, relative_path, ai_relative_path, content_hash, mime_type,
      page_index, original_filename, sort_order, created_at
    ) VALUES (
      @id, @aarId, @relativePath, @aiRelativePath, @contentHash, @mimeType,
      @pageIndex, @originalFilename, @sortOrder, @createdAt
    )`
  ).run({
    id,
    aarId: input.aarId,
    relativePath,
    aiRelativePath: input.aiRelativePath ?? null,
    contentHash,
    mimeType: input.mimeType,
    pageIndex: input.pageIndex ?? null,
    originalFilename: input.originalFilename ?? null,
    sortOrder: maxOrder.m + 1,
    createdAt
  })

  db.prepare(`UPDATE aar SET updated_at = ? WHERE id = ?`).run(createdAt, input.aarId)
  return getAttachment(db, id)!
}

export function setAttachmentAiPath(
  db: Database.Database,
  id: string,
  aiRelativePath: string | null,
  deps?: AttachmentStoreDeps
): AarAttachment {
  const existing = getAttachment(db, id)
  if (!existing) throw new Error(`Attachment not found: ${id}`)
  if (aiRelativePath) {
    const abs = absoluteAttachmentPath(aiRelativePath, deps)
    mkdirSync(dirname(abs), { recursive: true })
  }
  db.prepare(`UPDATE aar_attachment SET ai_relative_path = ? WHERE id = ?`).run(aiRelativePath, id)
  return getAttachment(db, id)!
}

export function writeAiDerivative(
  relativePath: string,
  jpegBytes: Buffer,
  deps?: AttachmentStoreDeps
): string {
  const abs = absoluteAttachmentPath(relativePath, deps)
  mkdirSync(dirname(abs), { recursive: true })
  const tmp = `${abs}.tmp`
  writeFileSync(tmp, jpegBytes)
  renameSync(tmp, abs)
  return relativePath
}

export function deleteAttachment(
  db: Database.Database,
  id: string,
  deps?: AttachmentStoreDeps
): void {
  const existing = getAttachment(db, id)
  if (!existing) return
  db.prepare(`DELETE FROM aar_attachment WHERE id = ?`).run(id)
  for (const rel of [existing.relativePath, existing.aiRelativePath]) {
    if (!rel) continue
    const abs = absoluteAttachmentPath(rel, deps)
    if (existsSync(abs)) {
      try {
        rmSync(abs, { force: true })
      } catch {
        // ignore filesystem cleanup errors
      }
    }
  }
  db.prepare(`UPDATE aar SET updated_at = ? WHERE id = ?`).run(nowIso(), existing.aarId)
}

export function countAttachments(db: Database.Database): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM aar_attachment`).get() as { c: number }).c
}
