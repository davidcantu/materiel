#!/usr/bin/env npx tsx
/**
 * Generate an Ed25519 keypair for Materiel license issue/verify.
 *
 * Usage: npm run license:keypair
 *
 * 1. Copy the SPKI base64 into src/main/license/public-key.ts
 *    (MATERIEL_LICENSE_PUBLIC_KEY_SPKI_B64).
 * 2. Store the private PEM in a password manager as LICENSE_SIGNING_PRIVATE_KEY.
 * 3. Never commit the private key.
 */

import { generateKeyPairSync } from 'crypto'

function main(): void {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string

  console.log('=== Public key (embed in src/main/license/public-key.ts) ===')
  console.log(`MATERIEL_LICENSE_PUBLIC_KEY_SPKI_B64 = '${pubDer.toString('base64')}'`)
  console.log('')
  console.log(pubPem)
  console.log('=== Private key (LICENSE_SIGNING_PRIVATE_KEY — do not commit) ===')
  console.log(privPem)
  console.log('=== Issue example ===')
  console.log(
    'LICENSE_SIGNING_PRIVATE_KEY="$(cat materiel-license.pem)" npm run license:issue -- --email customer@example.com'
  )
}

main()
