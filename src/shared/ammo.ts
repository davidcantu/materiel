/** Ammo inventory types shared across main / preload / renderer. */

export type AmmoType = 'Factory' | 'Handload'

export type AmmoInventoryInfo = {
  id: string
  /** Internal label (auto-generated when not set by the user). */
  name: string
  type: AmmoType
  caliber: string
  quantity: number
  /** Date made (handload) or purchased (factory) — ISO date YYYY-MM-DD. */
  acquiredDate: string | null
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
  /** Optional; auto-generated from cartridge + type (+ date) when omitted. */
  name?: string
  type: AmmoType
  caliber: string
  quantity: number
  /** Required on create: date made or purchased (YYYY-MM-DD). */
  acquiredDate: string
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

/** Build a stable internal ammo label when the UI no longer collects a name. */
export function defaultAmmoName(input: {
  caliber: string
  type: AmmoType
  acquiredDate?: string | null
  manufacturer?: string | null
}): string {
  const caliber = input.caliber.trim()
  const date = input.acquiredDate?.trim()
  if (input.type === 'Factory' && input.manufacturer?.trim()) {
    return date
      ? `${input.manufacturer.trim()} ${caliber} (${date})`
      : `${input.manufacturer.trim()} ${caliber}`
  }
  return date ? `${caliber} ${input.type} (${date})` : `${caliber} ${input.type}`
}
