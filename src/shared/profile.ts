/** Local profile settings exposed to the renderer. */

import {
  PLATFORMS,
  isValidPlatform,
  type Platform
} from './platforms'

export type ProfileInfo = {
  id: string
  /**
   * Local identity mirror of email (legacy column).
   * Prefer `email` — username is kept in sync when email is set.
   */
  username: string
  firstName: string
  lastName: string
  /** Primary local identity — email is the username. */
  email: string | null
  city: string
  state: string
  country: string
  competitionSeries: string[]
  profileImageUrl: string | null
  trackValue: boolean
  trackAmmo: boolean
  /** Reloading load-development recipes. */
  trackLoads: boolean
  /** Firearm platforms the user wants to track. */
  trackedPlatforms: Platform[]
  /** First-run Q&A completed (after email identity). */
  onboardingComplete: boolean
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
  trackLoads?: boolean
  trackedPlatforms?: Platform[]
  onboardingComplete?: boolean
}

export function normalizeEmailIdentity(email: string): string {
  return email.trim().toLowerCase()
}

/** Practical email shape — one @ and a dotted domain. */
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

/** First-run Q&A still needed after email is set. */
export function needsOnboarding(profile: ProfileInfo | null | undefined): boolean {
  return hasLocalIdentity(profile) && !profile?.onboardingComplete
}

export function parseTrackedPlatforms(raw: string | null | undefined): Platform[] {
  if (!raw?.trim()) return [...PLATFORMS]
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...PLATFORMS]
    const platforms = parsed.filter(
      (p): p is Platform => typeof p === 'string' && isValidPlatform(p)
    )
    return platforms.length > 0 ? [...new Set(platforms)] : [...PLATFORMS]
  } catch {
    return [...PLATFORMS]
  }
}

export function serializeTrackedPlatforms(platforms: readonly Platform[]): string {
  const unique = [...new Set(platforms.filter(isValidPlatform))]
  return JSON.stringify(unique.length > 0 ? unique : [...PLATFORMS])
}

export function normalizeTrackedPlatforms(
  platforms: readonly Platform[] | null | undefined
): Platform[] {
  if (!platforms || platforms.length === 0) return [...PLATFORMS]
  const filtered = [...new Set(platforms.filter(isValidPlatform))]
  return filtered.length > 0 ? filtered : [...PLATFORMS]
}
