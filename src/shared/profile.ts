/** Local profile settings exposed to the renderer. */

export type ProfileInfo = {
  id: string
  /**
   * Local identity mirror of email (license pairing / legacy column).
   * Prefer `email` — username is kept in sync when email is set.
   */
  username: string
  firstName: string
  lastName: string
  /** Primary local identity — email IS the username for license pairing. */
  email: string | null
  city: string
  state: string
  country: string
  competitionSeries: string[]
  profileImageUrl: string | null
  trackValue: boolean
  trackAmmo: boolean
  unlockPinSet: boolean
  createdAt: string
  updatedAt: string
}

export type ProfilePatch = {
  /** @deprecated Prefer `email` — when set alone and email-shaped, becomes email. */
  username?: string
  firstName?: string
  lastName?: string
  email?: string | null
  city?: string
  state?: string
  country?: string
  profileImageUrl?: string | null
  trackValue?: boolean
  trackAmmo?: boolean
}

export function normalizeEmailIdentity(email: string): string {
  return email.trim().toLowerCase()
}

/** Practical email shape — one @ and a dotted domain (same bar as license keys). */
export function isValidEmailIdentity(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmailIdentity(email))
}

/** @deprecated Use normalizeEmailIdentity — username is the email. */
export function normalizeUsername(username: string): string {
  return normalizeEmailIdentity(username)
}

/** @deprecated Use isValidEmailIdentity — username is the email. */
export function isValidUsername(username: string): boolean {
  return isValidEmailIdentity(username)
}

/** First-run / gate: local identity is ready when a valid email is stored. */
export function hasLocalIdentity(profile: ProfileInfo | null | undefined): boolean {
  return Boolean(profile?.email && isValidEmailIdentity(profile.email))
}

/** @deprecated Use hasLocalIdentity. */
export function hasLocalUsername(profile: ProfileInfo | null | undefined): boolean {
  return hasLocalIdentity(profile)
}
