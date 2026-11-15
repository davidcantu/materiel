#!/usr/bin/env npx tsx
/**
 * Issue a Materiel paid license key after Venmo (or other manual payment).
 *
 * Usage:
 *   LICENSE_SIGNING_SECRET='…' npm run license:issue -- --email user@example.com
 *
 * Prints the key to stdout for you to email to the customer.
 * Never commit the production signing secret.
 */

import { issueLicenseKey, isValidEmailShape, normalizeEmail } from '../src/main/license/crypto'

function printUsage(): void {
  console.error(`Usage:
  LICENSE_SIGNING_SECRET='…' npm run license:issue -- --email user@example.com

Options:
  --email <addr>   Customer email the key is bound to (required)
  --help           Show this help

The same secret must be available to the desktop app as
MAIN_VITE_LICENSE_SIGNING_SECRET (or LICENSE_SIGNING_SECRET) so activation
can verify the key offline.`)
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

  const secret = process.env.LICENSE_SIGNING_SECRET?.trim()
  if (!secret) {
    console.error('Error: set LICENSE_SIGNING_SECRET in the environment (do not commit it).')
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
    const key = issueLicenseKey(normalized, secret)
    // Human-readable lines on stderr; key alone on stdout for piping.
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
