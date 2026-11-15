/**
 * Local license gate (stub).
 *
 * Free tier: up to FREE_RIFLE_LIMIT complete rifle systems.
 * Paid: local key format MAT-XXXX-XXXX-XXXX stored via safeStorage.
 *
 * TODO:
 * - Count complete systems from SQLite
 * - Encrypt/decrypt key with Electron safeStorage / OS keychain
 * - Enforce create-build gate in IPC handlers
 */

export const FREE_RIFLE_LIMIT = 2

export type LicenseStatus = {
  tier: 'free' | 'paid'
  freeRifleLimit: number
  completeRifleCount: number
  canCreateRifle: boolean
  keyPresent: boolean
}

/**
 * Dev / mock status — unlocked for scaffolding.
 * Follow-up: read encrypted key file and query system count.
 */
export function getLicenseStatus(completeRifleCount = 0): LicenseStatus {
  const keyPresent = false
  const tier: LicenseStatus['tier'] = keyPresent ? 'paid' : 'free'
  const canCreateRifle = tier === 'paid' || completeRifleCount < FREE_RIFLE_LIMIT

  return {
    tier,
    freeRifleLimit: FREE_RIFLE_LIMIT,
    completeRifleCount,
    canCreateRifle,
    keyPresent
  }
}

export function validateLicenseKeyFormat(key: string): boolean {
  return /^MAT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key.trim().toUpperCase())
}

export async function saveLicenseKey(key: string): Promise<void> {
  void key
  // TODO: encrypt with safeStorage and persist under userData
  throw new Error('License key persistence not implemented yet')
}
