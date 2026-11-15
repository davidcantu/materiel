/** Minimal ammo inventory types for log session ammo selection. */

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
  createdAt: string
  updatedAt: string
}
