#!/usr/bin/env npx tsx
/**
 * Issue a Materiel paid license key after Venmo (or other manual payment).
 *
 * Usage:
 *   LICENSE_SIGNING_PRIVATE_KEY="$(cat materiel-license.pem)" \
 *     npm run license:issue -- --email user@example.com
 *
 * Generate a keypair (once): npm run license:keypair
 * Embed the printed public SPKI base64 in src/main/license/public-key.ts
 * Keep the private PEM only in a password manager — never commit it.
 *
 * Prints the key to stdout for you to email to the customer.
 */

import {
  issueLicenseKey,
  isValidEmailShape,
  normalizeEmail,
  resolveSigningPrivateKey
} from '../src/main/license/crypto'

function printUsage(): void {
  console.error(`Usage:
  LICENSE_SIGNING_PRIVATE_KEY="$(cat materiel-license.pem)" \\
    npm run license:issue -- --email user@example.com

Options:
  --email <addr>   Customer email the key is bound to (required)
  --help           Show this help

The desktop app verifies with the embedded Ed25519 public key only
(see src/main/license/public-key.ts). Generate a pair with:
  npm run license:keypair`)
}

function parseArgs(argv: string[]): { email: string | null; help: boolean } {
  let email: string | null = null
  let help = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      help = true
    } else if (arg === '--email' || arg === '-e') {
      email = argv[++i] ?? null
    } else if (arg.startsWith('--email=')) {
      email = arg.slice('--email='.length)
    }
  }
  return { email, help }
}

function main(): void {
  const { email, help } = parseArgs(process.argv.slice(2))
  if (help) {
    printUsage()
    process.exit(0)
  }

  const privateKey = resolveSigningPrivateKey()
  if (!privateKey) {
    console.error(
      'Error: set LICENSE_SIGNING_PRIVATE_KEY to a PKCS8 PEM (or base64 DER) Ed25519 private key.'
    )
    printUsage()
    process.exit(1)
  }

  if (!email) {
    console.error('Error: --email is required.')
    printUsage()
    process.exit(1)
  }

  const normalized = normalizeEmail(email)
  if (!isValidEmailShape(normalized)) {
    console.error(`Error: invalid email: ${email}`)
    process.exit(1)
  }

  try {
    const key = issueLicenseKey(normalized, privateKey)
    console.error(`Issued Materiel license for ${normalized}`)
    console.error(
      'Email this key to the customer. They activate with the same email + key in Settings.'
    )
    console.log(key)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
