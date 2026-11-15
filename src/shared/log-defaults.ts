/**
 * Smart defaults for shooting-log forms (rifle → cartridge, locations, ammo pick).
 * Pure helpers — safe to use from renderer or tests.
 */

import type { AmmoInventoryInfo } from './ammo'
import type { PartInfo } from './parts'
import type { ShootingLogInfo } from './shooting-logs'
import type { CompleteSystemInfo } from './systems'

export type LocationSuggestion = {
  location: string
  count: number
  lastUsed: string
}

/** Cartridge/caliber for a complete system (factory cartridge or barrel caliber). */
export function systemCaliber(
  system: CompleteSystemInfo | undefined,
  partsById: Map<string, PartInfo>
): string | null {
  if (!system) return null
  if (system.buildType === 'factory') return system.factoryCartridge
  return partsById.get(system.barrelId)?.caliber ?? null
}

/**
 * Unique locations ordered by frequency (desc), then most recent use (desc).
 */
export function rankLocations(logs: ShootingLogInfo[]): LocationSuggestion[] {
  const byLocation = new Map<string, { count: number; lastUsed: string }>()

  for (const log of logs) {
    const location = log.location.trim()
    if (!location) continue
    const stamp = log.date > log.createdAt ? log.date : log.createdAt
    const existing = byLocation.get(location)
    if (!existing) {
      byLocation.set(location, { count: 1, lastUsed: stamp })
      continue
    }
    existing.count += 1
    if (stamp > existing.lastUsed) existing.lastUsed = stamp
  }

  return [...byLocation.entries()]
    .map(([location, stats]) => ({
      location,
      count: stats.count,
      lastUsed: stats.lastUsed
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      if (a.lastUsed === b.lastUsed) return a.location.localeCompare(b.location)
      return a.lastUsed < b.lastUsed ? 1 : -1
    })
}

export type PickDefaultAmmoOptions = {
  ammo: AmmoInventoryInfo[]
  caliber: string | null
  roundsFired: number
  systemId: string | null
  logs: ShootingLogInfo[]
  /** Session sticky lot — used when still a valid candidate. */
  preferredAmmoId?: string | null
}

/**
 * Pick an inventory lot for deduction once rifle + rounds are known.
 * Prefers: sticky lot → previously used with this rifle → most recently used overall.
 * Candidates must match caliber and have quantity >= roundsFired.
 */
export function pickDefaultAmmo(options: PickDefaultAmmoOptions): string | null {
  const { ammo, caliber, roundsFired, systemId, logs, preferredAmmoId } = options
  if (!caliber || !Number.isFinite(roundsFired) || roundsFired < 0) return null

  const candidates = ammo.filter((item) => item.caliber === caliber && item.quantity >= roundsFired)
  if (candidates.length === 0) return null

  const candidateIds = new Set(candidates.map((item) => item.id))

  if (preferredAmmoId && candidateIds.has(preferredAmmoId)) {
    return preferredAmmoId
  }

  const byRecency = (aId: string | null, bId: string | null): number => {
    // Higher (more recent) stamp wins; missing stamps sort last.
    const stamp = (id: string | null): string => {
      if (!id) return ''
      let best = ''
      for (const log of logs) {
        if (log.ammoId !== id) continue
        const s = log.date > log.createdAt ? log.date : log.createdAt
        if (s > best) best = s
      }
      return best
    }
    const a = stamp(aId)
    const b = stamp(bId)
    if (a === b) return 0
    if (!a) return 1
    if (!b) return -1
    return a < b ? 1 : -1
  }

  if (systemId) {
    const tied = candidates
      .filter((item) => logs.some((log) => log.systemId === systemId && log.ammoId === item.id))
      .sort((a, b) => byRecency(a.id, b.id))
    if (tied.length > 0) return tied[0].id
  }

  const withHistory = candidates
    .filter((item) => logs.some((log) => log.ammoId === item.id))
    .sort((a, b) => byRecency(a.id, b.id))
  if (withHistory.length > 0) return withHistory[0].id

  // No usage history — prefer the lot with the most quantity remaining.
  return [...candidates].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))[0]
    .id
}
