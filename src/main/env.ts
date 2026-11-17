/**
 * App environment helpers shared by key storage and OAuth tokens.
 */

export function resolveAppEnv(env: NodeJS.ProcessEnv = process.env): string {
  return (env.MAIN_VITE_APP_ENV ?? env.VITE_APP_ENV ?? '').trim().toLowerCase()
}

/** Production builds must not fall back to plaintext key/token files. */
export function isProductionAppEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveAppEnv(env) === 'production'
}
