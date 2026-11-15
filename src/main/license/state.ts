/**
 * Sync `license_state` singleton row with activation status.
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import { requireDatabase } from '../db/connection'
import { licenseKeyFingerprint } from './crypto'
import type { LicenseTier } from '../../shared/license'

export type LicenseStateRow = {
  tier: LicenseTier
  keyPresent: boolean
  keyFingerprint: string | null
  activatedAt: string | null
  updatedAt: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function resolveDb(db?: Database.Database): Database.Database {
  return db ?? requireDatabase().db
}

export function ensureLicenseState(db?: Database.Database): LicenseStateRow {
  const database = resolveDb(db)
  const existing = database.prepare(`SELECT id FROM license_state WHERE id = 1`).get() as
    { id: number } | undefined
  if (!existing) {
    const updatedAt = nowIso()
    database
      .prepare(
        `INSERT INTO license_state (id, tier, key_present, key_fingerprint, activated_at, updated_at)
         VALUES (1, 'free', 0, NULL, NULL, ?)`
      )
      .run(updatedAt)
  }
  return readLicenseState(database)
}

export function readLicenseState(db?: Database.Database): LicenseStateRow {
  const database = resolveDb(db)
  ensureLicenseStateRow(database)
  const row = database
    .prepare(
      `SELECT tier, key_present, key_fingerprint, activated_at, updated_at FROM license_state WHERE id = 1`
    )
    .get() as {
    tier: LicenseTier
    key_present: number
    key_fingerprint: string | null
    activated_at: string | null
    updated_at: string
  }

  return {
    tier: row.tier,
    keyPresent: row.key_present === 1,
    keyFingerprint: row.key_fingerprint,
    activatedAt: row.activated_at,
    updatedAt: row.updated_at
  }
}

function ensureLicenseStateRow(db: Database.Database): void {
  const existing = db.prepare(`SELECT id FROM license_state WHERE id = 1`).get() as
    { id: number } | undefined
  if (!existing) {
    db.prepare(
      `INSERT INTO license_state (id, tier, key_present, key_fingerprint, activated_at, updated_at)
       VALUES (1, 'free', 0, NULL, NULL, ?)`
    ).run(nowIso())
  }
}

export function markLicenseActivated(
  input: { email: string; key: string; activatedAt?: string },
  db?: Database.Database
): LicenseStateRow {
  const database = resolveDb(db)
  ensureLicenseStateRow(database)
  const activatedAt = input.activatedAt ?? nowIso()
  const updatedAt = nowIso()
  database
    .prepare(
      `UPDATE license_state SET
      tier = 'paid',
      key_present = 1,
      key_fingerprint = @fingerprint,
      activated_at = @activatedAt,
      updated_at = @updatedAt
    WHERE id = 1`
    )
    .run({
      fingerprint: licenseKeyFingerprint(input.key),
      activatedAt,
      updatedAt
    })
  void input.email
  return readLicenseState(database)
}

export function markLicenseCleared(db?: Database.Database): LicenseStateRow {
  const database = resolveDb(db)
  ensureLicenseStateRow(database)
  const updatedAt = nowIso()
  database
    .prepare(
      `UPDATE license_state SET
      tier = 'free',
      key_present = 0,
      key_fingerprint = NULL,
      activated_at = NULL,
      updated_at = ?
    WHERE id = 1`
    )
    .run(updatedAt)
  return readLicenseState(database)
}
