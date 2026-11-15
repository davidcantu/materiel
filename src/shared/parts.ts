/** Part types shared across main / preload / renderer. */

export type PartType = 'Action' | 'Barrel' | 'Chassis' | 'Optic' | 'Suppressor' | 'Misc'
export type PartStatus = 'In Stock' | 'In Use' | 'Retired' | 'Sold'
export type MuzzleType = 'Suppressor' | 'Brake'

export type PartInfo = {
  id: string
  name: string
  manufacturer: string
  value: number
  type: PartType
  status: PartStatus
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
  name: string
  manufacturer: string
  value?: number
  type: PartType
  status?: PartStatus
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
  search?: string
}

export const PART_TYPES: PartType[] = ['Action', 'Barrel', 'Chassis', 'Optic', 'Suppressor', 'Misc']

export const PART_STATUSES: PartStatus[] = ['In Stock', 'In Use', 'Sold', 'Retired']

export const MAINTENANCE_PART_TYPES: PartType[] = ['Action', 'Barrel', 'Suppressor']

export function isMaintenanceTracked(type: PartType): boolean {
  return MAINTENANCE_PART_TYPES.includes(type)
}

export function partTypeLabel(type: PartType): string {
  return type === 'Suppressor' ? 'Muzzle Device' : type
}
