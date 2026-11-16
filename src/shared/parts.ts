/** Part types shared across main / preload / renderer. */

import type { Platform } from './platforms'
import {
  normalizePartPlatforms,
  platformsForPartType
} from './platforms'

export type PartType =
  | 'Action'
  | 'Barrel'
  | 'Chassis'
  | 'Optic'
  | 'Suppressor'
  | 'Misc'
  | 'Lower'
  | 'Upper'
  | 'Handguard'
  | 'BCG'
  | 'GasBlock'
  | 'Stock'
  | 'Frame'
  | 'Slide'
  | 'LaserIR'
  | 'Light'
  | 'Pistol'
  | 'Trigger'

export type PartStatus = 'In Stock' | 'In Use' | 'Retired' | 'Sold'
export type MuzzleType = 'Suppressor' | 'Brake'

export type PartInfo = {
  id: string
  manufacturer: string
  value: number
  type: PartType
  status: PartStatus
  /** Platforms this part may be used on. */
  platforms: Platform[]
  /** Barrel-only display name for round-count tracking. Null for other types. */
  name: string | null
  model: string | null
  serialNumber: string | null
  totalRoundCount: number
  roundsAfterCleaning: number
  maintenanceInterval: number | null
  caliber: string | null
  gunsmith: string | null
  twistRate: number | null
  barrelLife: number | null
  muzzleType: MuzzleType | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type PartInput = {
  id?: string
  manufacturer: string
  value?: number
  type: PartType
  status?: PartStatus
  platforms?: Platform[]
  /** Barrel-only name (ignored / cleared for other types). */
  name?: string | null
  model?: string | null
  serialNumber?: string | null
  totalRoundCount?: number
  roundsAfterCleaning?: number
  maintenanceInterval?: number | null
  caliber?: string | null
  gunsmith?: string | null
  twistRate?: number | null
  barrelLife?: number | null
  muzzleType?: MuzzleType | null
  notes?: string | null
}

export type PartUpdateInput = Partial<Omit<PartInput, 'id' | 'type'>> & {
  /** Type is locked after create; optional only for validation passthrough. */
  type?: PartType
}

export type PartsListFilter = {
  types?: PartType[]
  statuses?: PartStatus[]
  platforms?: Platform[]
  search?: string
}

export const PART_TYPES: PartType[] = [
  'Action',
  'Barrel',
  'Chassis',
  'Lower',
  'Upper',
  'Handguard',
  'BCG',
  'GasBlock',
  'Stock',
  'Frame',
  'Slide',
  'Pistol',
  'Trigger',
  'Optic',
  'LaserIR',
  'Light',
  'Suppressor',
  'Misc'
]

export const PART_STATUSES: PartStatus[] = ['In Stock', 'In Use', 'Sold', 'Retired']

/** Wear parts expose In Stock / In Use / Sold / Retired in the UI. */
export const WEAR_STATUS_PART_TYPES: PartType[] = ['Barrel', 'Trigger']

export const MAINTENANCE_PART_TYPES: PartType[] = ['Action', 'Barrel', 'Suppressor', 'BCG', 'Pistol']

/** Always-serialized receivers / complete pistols. Suppressors handled separately. Optics optional. */
export const SERIAL_REQUIRED_TYPES: PartType[] = ['Action', 'Lower', 'Pistol', 'Frame']

/** Types that show a serial field even when it is optional. */
export const SERIAL_OPTIONAL_TYPES: PartType[] = ['Optic']

export function isWearStatusTracked(type: PartType): boolean {
  return WEAR_STATUS_PART_TYPES.includes(type)
}

export function isMaintenanceTracked(type: PartType): boolean {
  return MAINTENANCE_PART_TYPES.includes(type)
}

/**
 * Serial numbers are required for serialized receivers/pistols,
 * and for muzzle devices that are Suppressors (not brakes).
 * Optics show an optional serial field separately.
 */
export function requiresSerialNumber(
  type: PartType,
  muzzleType?: MuzzleType | null
): boolean {
  if (type === 'Suppressor') {
    return muzzleType !== 'Brake'
  }
  return SERIAL_REQUIRED_TYPES.includes(type)
}

/** Whether the part form should show a serial number field (required or optional). */
export function showsSerialNumberField(
  type: PartType,
  muzzleType?: MuzzleType | null
): boolean {
  return requiresSerialNumber(type, muzzleType) || SERIAL_OPTIONAL_TYPES.includes(type)
}

export function partTypeLabel(type: PartType): string {
  switch (type) {
    case 'Suppressor':
      return 'Muzzle Device'
    case 'LaserIR':
      return 'Laser / IR'
    case 'Light':
      return 'Weapon Light'
    case 'GasBlock':
      return 'Gas Block'
    case 'BCG':
      return 'BCG'
    case 'Lower':
      return 'Lower'
    case 'Upper':
      return 'Upper'
    case 'Pistol':
      return 'Pistol'
    case 'Trigger':
      return 'Trigger'
    default:
      return type
  }
}

export function resolvePartPlatforms(type: PartType, platforms?: Platform[] | null): Platform[] {
  return normalizePartPlatforms(type, platforms)
}

export function partSupportsPlatform(platforms: readonly Platform[], platform: Platform): boolean {
  return platforms.includes(platform)
}

export { platformsForPartType }
