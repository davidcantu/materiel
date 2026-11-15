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
  'Optic',
  'LaserIR',
  'Light',
  'Suppressor',
  'Misc'
]

export const PART_STATUSES: PartStatus[] = ['In Stock', 'In Use', 'Sold', 'Retired']

export const MAINTENANCE_PART_TYPES: PartType[] = ['Action', 'Barrel', 'Suppressor', 'BCG']

export const SERIAL_REQUIRED_TYPES: PartType[] = ['Action', 'Optic', 'Lower', 'Frame']

export function isMaintenanceTracked(type: PartType): boolean {
  return MAINTENANCE_PART_TYPES.includes(type)
}

export function requiresSerialNumber(type: PartType): boolean {
  return SERIAL_REQUIRED_TYPES.includes(type)
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
