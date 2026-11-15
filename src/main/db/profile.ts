/**
 * Single local profile row (settings: email identity, trackValue, trackAmmo).
 * Email is the username for license pairing; `username` column mirrors email.
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import { isValidEmailIdentity, normalizeEmailIdentity } from '../../shared/profile'
import type { CompetitionSeries, Profile } from './types'

type ProfileRow = {
  id: string
  username: string
  first_name: string
  last_name: string
  email: string | null
  city: string
  state: string
  country: string
  competition_series: string
  profile_image_url: string | null
  track_value: number
  track_ammo: number
  unlock_pin_set: number
  created_at: string
  updated_at: string
}

export type ProfilePatch = {
  username?: string
  firstName?: string
  lastName?: string
  email?: string | null
  city?: string
  state?: string
  country?: string
  trackValue?: boolean
  trackAmmo?: boolean
}

const LOCAL_PROFILE_ID = 'local-profile'

function nowIso(): string {
  return new Date().toISOString()
}

function mapProfile(row: ProfileRow): Profile {
  let series: CompetitionSeries[] = []
  try {
    const parsed = JSON.parse(row.competition_series) as unknown
    if (Array.isArray(parsed)) {
      series = parsed.filter(
        (s): s is CompetitionSeries => typeof s === 'string'
      ) as CompetitionSeries[]
    }
  } catch {
    series = []
  }

  return {
    id: row.id,
    username: row.username ?? '',
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    city: row.city,
    state: row.state,
    country: row.country,
    competitionSeries: series,
    profileImageUrl: row.profile_image_url,
    trackValue: row.track_value === 1,
    trackAmmo: row.track_ammo === 1,
    unlockPinSet: row.unlock_pin_set === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function ensureLocalProfile(db: Database.Database): Profile {
  const existing = db.prepare(`SELECT * FROM profile WHERE id = ?`).get(LOCAL_PROFILE_ID) as
    ProfileRow | undefined
  if (existing) return mapProfile(existing)

  const any = db.prepare(`SELECT * FROM profile LIMIT 1`).get() as ProfileRow | undefined
  if (any) return mapProfile(any)

  const createdAt = nowIso()
  db.prepare(
    `INSERT INTO profile (
      id, username, first_name, last_name, email, city, state, country,
      competition_series, track_value, track_ammo, unlock_pin_set,
      created_at, updated_at
    ) VALUES (
      @id, '', '', '', NULL, '', '', '',
      '[]', 1, 1, 0,
      @createdAt, @createdAt
    )`
  ).run({ id: LOCAL_PROFILE_ID, createdAt })

  return getProfile(db)!
}

export function getProfile(db: Database.Database): Profile | null {
  const row = db.prepare(`SELECT * FROM profile LIMIT 1`).get() as ProfileRow | undefined
  return row ? mapProfile(row) : null
}

export function updateProfile(db: Database.Database, patch: ProfilePatch): Profile {
  const existing = ensureLocalProfile(db)
  const updatedAt = nowIso()

  let nextEmail = existing.email
  let nextUsername = existing.username

  if (patch.email !== undefined) {
    if (patch.email === null || patch.email.trim() === '') {
      nextEmail = null
      nextUsername = ''
    } else {
      const normalized = normalizeEmailIdentity(patch.email)
      if (!isValidEmailIdentity(normalized)) {
        throw new Error('Enter a valid email address.')
      }
      nextEmail = normalized
      nextUsername = normalized
    }
  } else if (patch.username !== undefined) {
    // Legacy: username patch — if email-shaped, treat as identity email.
    const normalized = normalizeEmailIdentity(patch.username)
    if (!isValidEmailIdentity(normalized)) {
      throw new Error('Enter a valid email address (email is your username).')
    }
    nextEmail = normalized
    nextUsername = normalized
  }

  db.prepare(
    `UPDATE profile SET
      username = @username,
      first_name = @firstName,
      last_name = @lastName,
      email = @email,
      city = @city,
      state = @state,
      country = @country,
      track_value = @trackValue,
      track_ammo = @trackAmmo,
      updated_at = @updatedAt
    WHERE id = @id`
  ).run({
    id: existing.id,
    username: nextUsername,
    firstName: patch.firstName ?? existing.firstName,
    lastName: patch.lastName ?? existing.lastName,
    email: nextEmail,
    city: patch.city ?? existing.city,
    state: patch.state ?? existing.state,
    country: patch.country ?? existing.country,
    trackValue: (patch.trackValue ?? existing.trackValue) ? 1 : 0,
    trackAmmo: (patch.trackAmmo ?? existing.trackAmmo) ? 1 : 0,
    updatedAt
  })

  return getProfile(db)!
}
