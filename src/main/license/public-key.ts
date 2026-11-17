/**
 * Materiel license verify public key (Ed25519 SPKI, DER base64).
 *
 * Only the public key lives in the app. The matching private key is held by the
 * operator (LICENSE_SIGNING_PRIVATE_KEY) and used solely by `npm run license:issue`.
 *
 * Rotate by generating a new pair (`npm run license:keypair`), updating this
 * constant, and issuing new keys with the new private key.
 */

import { createPublicKey, type KeyObject } from 'crypto'

/** SPKI DER (Ed25519) as standard base64 — safe to ship in the binary. */
export const MATERIEL_LICENSE_PUBLIC_KEY_SPKI_B64 =
  'MCowBQYDK2VwAyEA2f+8fC3JLxRqilDbfC3TQvF+JvOT4TekNUb+5X09M5c='

let cached: KeyObject | null = null

export function getMaterielLicensePublicKey(): KeyObject {
  if (!cached) {
    cached = createPublicKey({
      key: Buffer.from(MATERIEL_LICENSE_PUBLIC_KEY_SPKI_B64, 'base64'),
      format: 'der',
      type: 'spki'
    })
  }
  return cached
}
