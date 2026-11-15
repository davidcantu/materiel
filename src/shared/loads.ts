/** Load development (reloading recipe) types shared across main / preload / renderer. */

export type LoadDevelopmentInfo = {
  id: string
  name: string
  caliber: string
  bulletManufacturer: string
  bulletModel: string
  brassManufacturer: string
  brassModel: string | null
  powderManufacturer: string
  powderModel: string
  primerManufacturer: string
  primerModel: string
  powderCharge: number
  coal: number
  cbto: number | null
  velocity: number | null
  sd: number | null
  es: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type LoadInput = {
  id?: string
  name: string
  caliber: string
  bulletManufacturer: string
  bulletModel: string
  brassManufacturer: string
  brassModel?: string | null
  powderManufacturer: string
  powderModel: string
  primerManufacturer: string
  primerModel: string
  powderCharge: number
  coal: number
  cbto?: number | null
  velocity?: number | null
  sd?: number | null
  es?: number | null
  notes?: string | null
}

export type LoadUpdateInput = Partial<Omit<LoadInput, 'id'>>
