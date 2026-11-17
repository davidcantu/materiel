/**
 * Google Drive backup provider.
 *
 * Real OAuth (PKCE loopback) + Drive API when MAIN_VITE_GOOGLE_CLIENT_ID is set.
 * Otherwise remains a clear stub — mock provider still works in `npm run dev`.
 */

import { createReadStream, createWriteStream, existsSync, statSync } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import {
  authorizeWithLoopback,
  refreshAccessToken,
  type OAuthTokenResponse
} from './oauth-loopback'
import {
  clearOAuthTokens,
  loadOAuthTokens,
  saveOAuthTokens,
  type StoredOAuthTokens
} from './tokens'
import type { BackupProvider, BackupUploadResult } from './types'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const SCOPES = ['https://www.googleapis.com/auth/drive.file']
const APP_FOLDER_NAME = 'Materiel Backups'

function clientId(): string | undefined {
  const id = process.env.MAIN_VITE_GOOGLE_CLIENT_ID?.trim()
  return id || undefined
}

function requireClientId(): string {
  const id = clientId()
  if (!id) {
    throw new Error(
      'Google Drive OAuth is not configured. Set MAIN_VITE_GOOGLE_CLIENT_ID (see docs/backup.md).'
    )
  }
  return id
}

function tokensFromResponse(
  json: OAuthTokenResponse,
  previous?: StoredOAuthTokens | null
): StoredOAuthTokens {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? previous?.refreshToken,
    expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
    tokenType: json.token_type,
    scope: json.scope
  }
}

async function getValidAccessToken(): Promise<string> {
  const id = requireClientId()
  const stored = loadOAuthTokens('google-drive')
  if (!stored) {
    throw new Error('Google Drive is not authenticated. Call authenticate() first.')
  }

  if (stored.expiresAt && stored.expiresAt > Date.now() + 60_000) {
    return stored.accessToken
  }

  if (!stored.refreshToken) {
    throw new Error('Google Drive session expired. Re-authenticate.')
  }

  const refreshed = await refreshAccessToken({
    tokenUrl: TOKEN_URL,
    clientId: id,
    refreshToken: stored.refreshToken
  })
  const next = tokensFromResponse(refreshed, stored)
  saveOAuthTokens('google-drive', next)
  return next.accessToken
}

async function ensureAppFolder(accessToken: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  )
  const listRes = await fetch(`${DRIVE_FILES}?q=${q}&spaces=drive&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!listRes.ok) {
    throw new Error(`Drive folder list failed (${listRes.status})`)
  }
  const list = (await listRes.json()) as { files?: Array<{ id: string }> }
  if (list.files?.[0]?.id) return list.files[0].id

  const createRes = await fetch(DRIVE_FILES, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  })
  if (!createRes.ok) {
    throw new Error(`Drive folder create failed (${createRes.status})`)
  }
  const created = (await createRes.json()) as { id: string }
  return created.id
}

export const googleDriveBackupProvider: BackupProvider = {
  id: 'google-drive',
  label: 'Google Drive',

  isConfigured() {
    return Boolean(clientId())
  },

  async isAuthenticated() {
    if (!clientId()) return false
    return loadOAuthTokens('google-drive') !== null
  },

  async authenticate() {
    const id = requireClientId()
    const json = await authorizeWithLoopback({
      authorizeUrl: AUTHORIZE_URL,
      tokenUrl: TOKEN_URL,
      clientId: id,
      scopes: SCOPES,
      authorizeExtra: {
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true'
      }
    })
    saveOAuthTokens('google-drive', tokensFromResponse(json))
    console.info('[backup:google-drive] authenticated')
  },

  async disconnect() {
    clearOAuthTokens('google-drive')
  },

  async uploadEncryptedBackup(localPath: string, fileName: string): Promise<BackupUploadResult> {
    if (!existsSync(localPath)) {
      throw new Error(`Backup source missing: ${localPath}`)
    }
    if (!this.isConfigured()) {
      throw new Error(
        'Google Drive OAuth is not configured. Set MAIN_VITE_GOOGLE_CLIENT_ID (see docs/backup.md).'
      )
    }

    const accessToken = await getValidAccessToken()
    const folderId = await ensureAppFolder(accessToken)
    const bytes = statSync(localPath).size
    const boundary = `materiel_${Date.now()}`
    const meta = JSON.stringify({
      name: fileName,
      parents: [folderId]
    })

    // Multipart upload: metadata + binary body.
    const preamble = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
        `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`
    )
    const epilogue = Buffer.from(`\r\n--${boundary}--`)
    const fileBuf = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      const stream = createReadStream(localPath)
      stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks)))
    })
    const body = Buffer.concat([preamble, fileBuf, epilogue])

    const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name,size`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length)
      },
      body: new Uint8Array(body)
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Google Drive upload failed (${res.status}): ${text.slice(0, 300)}`)
    }

    const json = (await res.json()) as { id?: string; name?: string }
    console.info(`[backup:google-drive] uploaded ${fileName}`)
    return {
      bytes,
      remoteId: json.id,
      remotePath: `${APP_FOLDER_NAME}/${json.name ?? fileName}`
    }
  },

  async downloadLatestBackup(destPath: string) {
    if (!this.isConfigured()) {
      throw new Error(
        'Google Drive OAuth is not configured. Set MAIN_VITE_GOOGLE_CLIENT_ID (see docs/backup.md).'
      )
    }
    const accessToken = await getValidAccessToken()
    const folderId = await ensureAppFolder(accessToken)
    const q = encodeURIComponent(
      `'${folderId}' in parents and trashed=false and name contains 'materiel-backup-'`
    )
    const listRes = await fetch(
      `${DRIVE_FILES}?q=${q}&orderBy=createdTime desc&pageSize=1&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!listRes.ok) {
      throw new Error(`Drive list failed (${listRes.status})`)
    }
    const list = (await listRes.json()) as { files?: Array<{ id: string; name: string }> }
    const file = list.files?.[0]
    if (!file) {
      throw new Error('No Google Drive backups found')
    }

    const dl = await fetch(`${DRIVE_FILES}/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!dl.ok || !dl.body) {
      throw new Error(`Drive download failed (${dl.status})`)
    }
    const nodeStream = Readable.fromWeb(dl.body as import('stream/web').ReadableStream)
    await pipeline(nodeStream, createWriteStream(destPath))
    console.info(`[backup:google-drive] downloaded ${file.name} → ${destPath}`)
  }
}
