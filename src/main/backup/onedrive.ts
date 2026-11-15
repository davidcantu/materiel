/**
 * OneDrive backup provider via Microsoft Graph.
 *
 * Real OAuth (PKCE loopback) when MAIN_VITE_ONEDRIVE_CLIENT_ID is set.
 * Otherwise clear stub errors; mock provider still works in `npm run dev`.
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

const AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH = 'https://graph.microsoft.com/v1.0'
const SCOPES = ['offline_access', 'Files.ReadWrite', 'User.Read']
const APP_FOLDER = 'Materiel Backups'

function clientId(): string | undefined {
  const id = process.env.MAIN_VITE_ONEDRIVE_CLIENT_ID?.trim()
  return id || undefined
}

function clientSecret(): string | undefined {
  const secret = process.env.MAIN_VITE_ONEDRIVE_CLIENT_SECRET?.trim()
  return secret || undefined
}

function requireClientId(): string {
  const id = clientId()
  if (!id) {
    throw new Error(
      'OneDrive OAuth is not configured. Set MAIN_VITE_ONEDRIVE_CLIENT_ID (see docs/backup.md).'
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
  const stored = loadOAuthTokens('onedrive')
  if (!stored) {
    throw new Error('OneDrive is not authenticated. Call authenticate() first.')
  }

  if (stored.expiresAt && stored.expiresAt > Date.now() + 60_000) {
    return stored.accessToken
  }

  if (!stored.refreshToken) {
    throw new Error('OneDrive session expired. Re-authenticate.')
  }

  const refreshed = await refreshAccessToken({
    tokenUrl: TOKEN_URL,
    clientId: id,
    clientSecret: clientSecret(),
    refreshToken: stored.refreshToken
  })
  const next = tokensFromResponse(refreshed, stored)
  saveOAuthTokens('onedrive', next)
  return next.accessToken
}

export const oneDriveBackupProvider: BackupProvider = {
  id: 'onedrive',
  label: 'OneDrive',

  isConfigured() {
    return Boolean(clientId())
  },

  async isAuthenticated() {
    if (!clientId()) return false
    return loadOAuthTokens('onedrive') !== null
  },

  async authenticate() {
    const id = requireClientId()
    const json = await authorizeWithLoopback({
      authorizeUrl: AUTHORIZE_URL,
      tokenUrl: TOKEN_URL,
      clientId: id,
      clientSecret: clientSecret(),
      scopes: SCOPES,
      authorizeExtra: {
        response_mode: 'query'
      }
    })
    saveOAuthTokens('onedrive', tokensFromResponse(json))
    console.info('[backup:onedrive] authenticated')
  },

  async disconnect() {
    clearOAuthTokens('onedrive')
  },

  async uploadEncryptedBackup(localPath: string, fileName: string): Promise<BackupUploadResult> {
    if (!existsSync(localPath)) {
      throw new Error(`Backup source missing: ${localPath}`)
    }
    if (!this.isConfigured()) {
      throw new Error(
        'OneDrive OAuth is not configured. Set MAIN_VITE_ONEDRIVE_CLIENT_ID (see docs/backup.md).'
      )
    }

    const accessToken = await getValidAccessToken()
    const bytes = statSync(localPath).size
    const remotePath = encodeURIComponent(`${APP_FOLDER}/${fileName}`)

    // Ensure folder exists (ignore conflict).
    await fetch(`${GRAPH}/me/drive/root:/${encodeURIComponent(APP_FOLDER)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: APP_FOLDER })
    }).catch(() => undefined)

    await fetch(`${GRAPH}/me/drive/root/children`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: APP_FOLDER,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail'
      })
    }).catch(() => undefined)

    // Simple upload (< 4MB typical for SQLite; use upload session for larger later).
    const fileBuf = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      const stream = createReadStream(localPath)
      stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks)))
    })

    const uploadUrl = `${GRAPH}/me/drive/root:/${remotePath}:/content`
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream'
      },
      body: new Uint8Array(fileBuf)
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OneDrive upload failed (${res.status}): ${text.slice(0, 300)}`)
    }

    const json = (await res.json()) as { id?: string; name?: string }
    console.info(`[backup:onedrive] uploaded ${fileName}`)
    return {
      bytes,
      remoteId: json.id,
      remotePath: `${APP_FOLDER}/${json.name ?? fileName}`
    }
  },

  async downloadLatestBackup(destPath: string) {
    if (!this.isConfigured()) {
      throw new Error(
        'OneDrive OAuth is not configured. Set MAIN_VITE_ONEDRIVE_CLIENT_ID (see docs/backup.md).'
      )
    }
    const accessToken = await getValidAccessToken()
    const folder = encodeURIComponent(APP_FOLDER)
    const listRes = await fetch(
      `${GRAPH}/me/drive/root:/${folder}:/children?$orderby=lastModifiedDateTime desc&$top=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!listRes.ok) {
      throw new Error(`OneDrive list failed (${listRes.status})`)
    }
    const list = (await listRes.json()) as {
      value?: Array<{ id: string; name: string; '@microsoft.graph.downloadUrl'?: string }>
    }
    const file = (list.value ?? []).find((f) => f.name.endsWith('.db'))
    if (!file) {
      throw new Error('No OneDrive backups found')
    }

    const downloadUrl =
      file['@microsoft.graph.downloadUrl'] ?? `${GRAPH}/me/drive/items/${file.id}/content`
    const dl = await fetch(downloadUrl, {
      headers: file['@microsoft.graph.downloadUrl']
        ? undefined
        : { Authorization: `Bearer ${accessToken}` }
    })
    if (!dl.ok || !dl.body) {
      throw new Error(`OneDrive download failed (${dl.status})`)
    }
    const nodeStream = Readable.fromWeb(dl.body as import('stream/web').ReadableStream)
    await pipeline(nodeStream, createWriteStream(destPath))
    console.info(`[backup:onedrive] downloaded ${file.name} → ${destPath}`)
  }
}
