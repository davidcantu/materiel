/**
 * Firearm platforms and part-category compatibility rules.
 * Parts are platform-scoped; builds filter inventory by these rules.
 */

import type { PartType } from './parts'

export type Platform = 'bolt_action' | 'ar_pattern' | 'pistol'

export const PLATFORMS: Platform[] = ['bolt_action', 'ar_pattern', 'pistol']

export const PLATFORM_LABELS: Record<Platform, string> = {
  bolt_action: 'Bolt Action',
  ar_pattern: 'AR-Pattern',
  pistol: 'Pistol'
}

/**
 * Categories offered per platform (inventory create / filter).
 * AR: Lower, Upper, Barrel (Upper/Barrel), Laser/IR, Light, Muzzle, Misc (+ Trigger wear).
 * Pistol: Pistol, Optic, Laser/IR, Light, Muzzle, Misc (+ Trigger wear).
 * Bolt: classic bolt set + Laser/IR + Trigger.
 */
export const PLATFORM_PART_TYPES: Record<Platform, readonly PartType[]> = {
  bolt_action: ['Action', 'Barrel', 'Chassis', 'Optic', 'LaserIR', 'Suppressor', 'Trigger', 'Misc'],
  ar_pattern: ['Lower', 'Upper', 'Barrel', 'LaserIR', 'Light', 'Suppressor', 'Trigger', 'Misc'],
  pistol: ['Pistol', 'Optic', 'LaserIR', 'Light', 'Suppressor', 'Trigger', 'Misc']
}

/**
 * Platforms a category may be assigned to.
 * Legacy types (Frame/Slide/Handguard/…) kept for existing rows / edit.
 */
export const PART_TYPE_PLATFORMS: Record<PartType, readonly Platform[]> = {
  Action: ['bolt_action'],
  Chassis: ['bolt_action'],
  Lower: ['ar_pattern'],
  Upper: ['ar_pattern'],
  Handguard: ['ar_pattern'],
  BCG: ['ar_pattern'],
  GasBlock: ['ar_pattern'],
  Stock: ['ar_pattern'],
  Frame: ['pistol'],
  Slide: ['pistol'],
  Pistol: ['pistol'],
  Trigger: ['bolt_action', 'ar_pattern', 'pistol'],
  Barrel: ['bolt_action', 'ar_pattern'],
  Optic: ['bolt_action', 'pistol'],
  LaserIR: ['bolt_action', 'ar_pattern', 'pistol'],
  Light: ['ar_pattern', 'pistol'],
  Suppressor: ['bolt_action', 'ar_pattern', 'pistol'],
  Misc: ['bolt_action', 'ar_pattern', 'pistol']
}

/** Required core slots stored as action_id / barrel_id / chassis_id. */
export type CoreSlot = 'primary' | 'barrel' | 'furniture'

export type PlatformCoreSlots = {
  primary: PartType
  barrel: PartType
  furniture: PartType
}

export const PLATFORM_CORE_SLOTS: Record<Platform, PlatformCoreSlots> = {
  bolt_action: { primary: 'Action', barrel: 'Barrel', furniture: 'Chassis' },
  ar_pattern: { primary: 'Lower', barrel: 'Barrel', furniture: 'Upper' },
  /** Complete pistol as one inventory item; all three columns reference that part. */
  pistol: { primary: 'Pistol', barrel: 'Pistol', furniture: 'Pistol' }
}

export const PLATFORM_CORE_LABELS: Record<
  Platform,
  { primary: string; barrel: string; furniture: string }
> = {
  bolt_action: {
    primary: 'Action / Receiver',
    barrel: 'Barrel',
    furniture: 'Chassis / Stock'
  },
  ar_pattern: {
    primary: 'Lower Receiver',
    barrel: 'Barrel',
    furniture: 'Upper Receiver'
  },
  pistol: {
    primary: 'Pistol',
    barrel: 'Pistol',
    furniture: 'Pistol'
  }
}

/** Platforms that use a single inventory part for all three core columns. */
export function isSingleCorePartPlatform(platform: Platform): boolean {
  const slots = PLATFORM_CORE_SLOTS[platform]
  return slots.primary === slots.barrel && slots.barrel === slots.furniture
}

/** Optional dedicated accessory slots on a complete system. */
export type AccessorySlot = 'optic' | 'suppressor' | 'laserIr' | 'light'

export const PLATFORM_ACCESSORY_SLOTS: Record<Platform, readonly AccessorySlot[]> = {
  bolt_action: ['optic', 'laserIr', 'suppressor'],
  ar_pattern: ['laserIr', 'light', 'suppressor'],
  pistol: ['optic', 'laserIr', 'light', 'suppressor']
}

export const ACCESSORY_SLOT_TYPE: Record<AccessorySlot, PartType> = {
  optic: 'Optic',
  suppressor: 'Suppressor',
  laserIr: 'LaserIR',
  light: 'Light'
}

export const ACCESSORY_SLOT_LABELS: Record<AccessorySlot, string> = {
  optic: 'Optic',
  suppressor: 'Muzzle Device',
  laserIr: 'Laser / IR',
  light: 'Weapon Light'
}

/** Extra parts selectable in the build accessory list (beyond dedicated slots). */
export function accessoryListTypes(platform: Platform): PartType[] {
  if (platform === 'ar_pattern') {
    return ['Trigger', 'Misc']
  }
  if (platform === 'bolt_action') {
    return ['Trigger', 'Misc']
  }
  return ['Trigger', 'Misc']
}

/** Categories offered when creating a part for the chosen platform set (intersection). */
export function partTypesForPlatforms(platforms: readonly Platform[]): PartType[] {
  if (platforms.length === 0) return []
  const sets = platforms.map((p) => new Set(PLATFORM_PART_TYPES[p]))
  const [first, ...rest] = sets
  return (Object.keys(PART_TYPE_PLATFORMS) as PartType[]).filter((type) =>
    [first, ...rest].every((set) => set.has(type))
  )
}

export function platformsForPartType(type: PartType): Platform[] {
  return [...PART_TYPE_PLATFORMS[type]]
}

/** Default platforms when creating a part of this type (single-platform categories pin to that platform). */
export function defaultPlatformsForPartType(type: PartType): Platform[] {
  return platformsForPartType(type)
}

export function isPartCompatibleWithPlatform(
  partPlatforms: readonly Platform[],
  platform: Platform
): boolean {
  return partPlatforms.includes(platform)
}

export function isValidPlatform(value: string): value is Platform {
  return (PLATFORMS as string[]).includes(value)
}

export function parsePlatformsJson(raw: string | null | undefined): Platform[] {
  if (!raw?.trim()) return ['bolt_action']
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return ['bolt_action']
    const platforms = parsed.filter((p): p is Platform => typeof p === 'string' && isValidPlatform(p))
    return platforms.length > 0 ? [...new Set(platforms)] : ['bolt_action']
  } catch {
    return ['bolt_action']
  }
}

export function serializePlatforms(platforms: readonly Platform[]): string {
  const unique = [...new Set(platforms.filter(isValidPlatform))]
  return JSON.stringify(unique.length > 0 ? unique : ['bolt_action'])
}

export function normalizePartPlatforms(
  type: PartType,
  requested?: readonly Platform[] | null
): Platform[] {
  const allowed = new Set(platformsForPartType(type))
  const source = requested && requested.length > 0 ? requested : defaultPlatformsForPartType(type)
  const filtered = [...new Set(source.filter((p) => allowed.has(p)))]
  if (filtered.length === 0) return defaultPlatformsForPartType(type)
  return filtered
}

export function platformLabel(platform: Platform): string {
  return PLATFORM_LABELS[platform]
}

export function coreSlotPartType(platform: Platform, slot: CoreSlot): PartType {
  const slots = PLATFORM_CORE_SLOTS[platform]
  if (slot === 'primary') return slots.primary
  if (slot === 'barrel') return slots.barrel
  return slots.furniture
}

/** Complete-system counts keyed by platform. */
export type PlatformSystemCounts = Record<Platform, number>

export function emptyPlatformCounts(): PlatformSystemCounts {
  return { bolt_action: 0, ar_pattern: 0, pistol: 0 }
}

export function totalPlatformCounts(counts: PlatformSystemCounts): number {
  return PLATFORMS.reduce((sum, platform) => sum + (counts[platform] ?? 0), 0)
}

export function normalizePlatformCounts(
  raw?: Partial<PlatformSystemCounts> | null
): PlatformSystemCounts {
  const next = emptyPlatformCounts()
  if (!raw) return next
  for (const platform of PLATFORMS) {
    const value = raw[platform]
    next[platform] = typeof value === 'number' && value > 0 ? Math.floor(value) : 0
  }
  return next
}
