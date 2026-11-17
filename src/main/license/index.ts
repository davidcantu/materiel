/**
 * Local license gate for Materiel.
 *
 * Free tier: up to FREE_PER_PLATFORM_LIMIT complete firearms per platform
 * (bolt / pistol / AR). Paid when exceeding 2 of any one platform.
 * Paid: MAT-1-… Ed25519 key bound to an email, stored via safeStorage.
 * Dev: MAIN_VITE_LICENSE_MODE=unlocked always allows creates.
 */

export { FREE_PER_PLATFORM_LIMIT, FREE_RIFLE_LIMIT, LICENSE_KEY_PREFIX } from './crypto'
export {
  issueLicenseKey,
  verifyLicenseKey,
  validateLicenseKeyFormat,
  normalizeEmail,
  resolveSigningPrivateKey,
  licenseKeyFingerprint,
  parseLicenseKey,
  parsePrivateKey,
  parsePublicKey,
  getMaterielLicensePublicKey,
  MATERIEL_LICENSE_PUBLIC_KEY_SPKI_B64
} from './crypto'
export { resolveLicenseMode, isLicenseUnlocked } from './mode'
export { getLicenseStatus, buildRifleLimitDenial } from './status'
export {
  assertCanCreateCompleteSystem,
  assertLicenseAllowsPlatformCounts,
  assertLicenseAllowsSystemCount,
  canCreateCompleteSystem,
  checkCreateCompleteSystem,
  LicenseLimitError
} from './gate'
export { activateLicense, clearLicense } from './activate'
export {
  loadStoredLicense,
  saveStoredLicense,
  clearStoredLicense,
  getLicenseFilePath
} from './store'
export {
  ensureLicenseState,
  readLicenseState,
  markLicenseActivated,
  markLicenseCleared
} from './state'
export { registerLicenseIpc } from './ipc'

import { registerLicenseIpc } from './ipc'
import { registerSystemsIpc } from '../systems/ipc'
import { registerPartsIpc } from '../parts/ipc'
import { registerLogsIpc } from '../logs/ipc'
import { registerAmmoIpc } from '../ammo/ipc'
import { registerDashboardIpc } from '../dashboard/ipc'
import { ensureLicenseState } from './state'
import { getLicenseStatus } from './status'

/** Wire license + gated systems IPC; sync license_state row. */
export function initLicenseSubsystem(): ReturnType<typeof getLicenseStatus> {
  try {
    ensureLicenseState()
  } catch (error) {
    console.warn('[license] could not ensure license_state:', error)
  }
  registerLicenseIpc()
  registerSystemsIpc()
  registerPartsIpc()
  registerLogsIpc()
  registerAmmoIpc()
  registerDashboardIpc()
  return getLicenseStatus()
}
