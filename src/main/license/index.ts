/**
 * Local license gate for Materiel.
 *
 * Free tier: up to FREE_RIFLE_LIMIT complete rifle systems.
 * Paid: MAT-1-… HMAC key bound to an email, stored via safeStorage.
 * Dev: MAIN_VITE_LICENSE_MODE=unlocked always allows creates.
 */

export { FREE_RIFLE_LIMIT, LICENSE_KEY_PREFIX } from './crypto'
export {
  issueLicenseKey,
  verifyLicenseKey,
  validateLicenseKeyFormat,
  normalizeEmail,
  resolveSigningSecret,
  licenseKeyFingerprint,
  parseLicenseKey
} from './crypto'
export { resolveLicenseMode, isLicenseUnlocked } from './mode'
export { getLicenseStatus, buildRifleLimitDenial } from './status'
export {
  assertCanCreateCompleteSystem,
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
  return getLicenseStatus()
}
