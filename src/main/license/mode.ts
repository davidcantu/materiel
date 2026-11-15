import type { LicenseMode } from '../../shared/license'

/**
 * Dev unlock: MAIN_VITE_LICENSE_MODE=unlocked (default in .env.development).
 * Production / test builds use `enforced`.
 */
export function resolveLicenseMode(env: NodeJS.ProcessEnv = process.env): LicenseMode {
  const raw = (env.MAIN_VITE_LICENSE_MODE ?? env.LICENSE_MODE ?? 'enforced').trim().toLowerCase()
  if (raw === 'unlocked' || raw === 'always-allow' || raw === 'dev') {
    return 'unlocked'
  }
  return 'enforced'
}

export function isLicenseUnlocked(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveLicenseMode(env) === 'unlocked'
}
