/**
 * Desktop OAuth 2.0 authorization-code + PKCE via loopback HTTP.
 * Public clients only (no client_secret). Includes CSRF `state` and escaped HTML.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { safeOpenExternal } from '../security/open-external'

export type OAuthTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

export type LoopbackAuthOptions = {
  authorizeUrl: string
  tokenUrl: string
  clientId: string
  scopes: string[]
  /** Extra authorize query params (e.g. access_type=offline). */
  authorizeExtra?: Record<string, string>
  /** Extra token body fields. */
  tokenExtra?: Record<string, string>
  timeoutMs?: number
  /** Injected for tests. */
  openExternal?: (url: string) => Promise<void>
}

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

function readRequestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', 'http://127.0.0.1')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sendHtml(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(body)
}

function statesEqual(expected: string, actual: string | null): boolean {
  if (!actual) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(actual)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Opens the system browser, listens on 127.0.0.1 for the redirect, exchanges the code.
 */
export async function authorizeWithLoopback(
  options: LoopbackAuthOptions
): Promise<OAuthTokenResponse> {
  const { verifier, challenge } = createPkce()
  const state = base64Url(randomBytes(24))
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000
  const openExternal = options.openExternal ?? ((url: string) => safeOpenExternal(url))

  return new Promise<OAuthTokenResponse>((resolve, reject) => {
    let settled = false
    let timer: NodeJS.Timeout | null = null

    const server = createServer(async (req, res) => {
      try {
        const url = readRequestUrl(req)
        if (url.pathname !== '/oauth2/callback' && url.pathname !== '/') {
          sendHtml(res, 404, '<h1>Not found</h1>')
          return
        }

        if (!statesEqual(state, url.searchParams.get('state'))) {
          sendHtml(res, 400, '<h1>Authorization failed</h1><p>Invalid OAuth state.</p>')
          finish(new Error('OAuth state mismatch'))
          return
        }

        const error = url.searchParams.get('error')
        if (error) {
          const desc = url.searchParams.get('error_description') ?? error
          sendHtml(
            res,
            400,
            `<h1>Authorization failed</h1><p>${escapeHtml(desc)}</p>`
          )
          finish(new Error(`OAuth error: ${desc}`))
          return
        }

        const code = url.searchParams.get('code')
        if (!code) {
          sendHtml(res, 400, '<h1>Missing authorization code</h1>')
          return
        }

        sendHtml(
          res,
          200,
          '<h1>Materiel connected</h1><p>You can close this window and return to the app.</p>'
        )

        const redirectUri = `http://127.0.0.1:${addressPort}/oauth2/callback`
        const body = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: options.clientId,
          code_verifier: verifier,
          ...options.tokenExtra
        })

        const tokenRes = await fetch(options.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        })
        const json = (await tokenRes.json()) as OAuthTokenResponse & {
          error?: string
          error_description?: string
        }
        if (!tokenRes.ok || !json.access_token) {
          finish(
            new Error(
              json.error_description || json.error || `Token exchange failed (${tokenRes.status})`
            )
          )
          return
        }
        finish(null, json)
      } catch (err) {
        finish(err instanceof Error ? err : new Error(String(err)))
      }
    })

    let addressPort = 0

    const finish = (err: Error | null, tokens?: OAuthTokenResponse): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      server.close()
      if (err) reject(err)
      else resolve(tokens!)
    }

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        finish(new Error('Failed to bind OAuth loopback server'))
        return
      }
      addressPort = addr.port
      const redirectUri = `http://127.0.0.1:${addressPort}/oauth2/callback`
      const authorize = new URL(options.authorizeUrl)
      authorize.searchParams.set('client_id', options.clientId)
      authorize.searchParams.set('response_type', 'code')
      authorize.searchParams.set('redirect_uri', redirectUri)
      authorize.searchParams.set('scope', options.scopes.join(' '))
      authorize.searchParams.set('code_challenge', challenge)
      authorize.searchParams.set('code_challenge_method', 'S256')
      authorize.searchParams.set('state', state)
      for (const [k, v] of Object.entries(options.authorizeExtra ?? {})) {
        authorize.searchParams.set(k, v)
      }

      timer = setTimeout(() => {
        finish(new Error('OAuth timed out — complete sign-in in the browser'))
      }, timeoutMs)

      void openExternal(authorize.toString()).catch((err) => {
        finish(err instanceof Error ? err : new Error(String(err)))
      })
    })

    server.on('error', (err) => finish(err))
  })
}

export async function refreshAccessToken(options: {
  tokenUrl: string
  clientId: string
  refreshToken: string
}): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: options.refreshToken,
    client_id: options.clientId
  })

  const res = await fetch(options.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const json = (await res.json()) as OAuthTokenResponse & {
    error?: string
    error_description?: string
  }
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `Refresh failed (${res.status})`)
  }
  return json
}
