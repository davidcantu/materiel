/** Local profile settings exposed to the renderer. */

export type ProfileInfo = {
  id: string
  /** Local identity handle (no password). Empty until first-run completes. */
  username: string
  firstName: string
  lastName: string
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

export function normalizeUsername(username: string): string {
  return username.trim()
}

/** Username is required for first-run; no password. */
export function isValidUsername(username: string): boolean {
  const value = normalizeUsername(username)
  return value.length >= 2 && value.length <= 64 && !/[\r\n\t]/.test(value)
}

/** First-run / gate: local identity is ready when a username is stored. */
export function hasLocalUsername(profile: ProfileInfo | null | undefined): boolean {
  return Boolean(profile && normalizeUsername(profile.username).length > 0)
}
