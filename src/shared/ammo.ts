/** Ammo inventory types shared across main / preload / renderer. */

export type AmmoType = 'Factory' | 'Handload'

export type AmmoInventoryInfo = {
  id: string
  name: string
  type: AmmoType
  caliber: string
  quantity: number
  loadId: string | null
  manufacturer: string | null
  lotNumber: string | null
  notes: string | null
  bulletManufacturer: string | null
  bulletType: string | null
  powderManufacturer: string | null
  powder: string | null
  chargeWeight: number | null
  primerManufacturer: string | null
  primer: string | null
  caseManufacturer: string | null
  caseName: string | null
  seatingDepth: string | null
  createdAt: string
  updatedAt: string
}

export type AmmoInput = {
  id?: string
  name: string
  type: AmmoType
  caliber: string
  quantity: number
  loadId?: string | null
  manufacturer?: string | null
  lotNumber?: string | null
  notes?: string | null
  bulletManufacturer?: string | null
  bulletType?: string | null
  powderManufacturer?: string | null
  powder?: string | null
  chargeWeight?: number | null
  primerManufacturer?: string | null
  primer?: string | null
  caseManufacturer?: string | null
  caseName?: string | null
  seatingDepth?: string | null
}

export type AmmoUpdateInput = Partial<Omit<AmmoInput, 'id'>>

export const AMMO_TYPES: AmmoType[] = ['Factory', 'Handload']
