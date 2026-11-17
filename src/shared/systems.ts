import type { Platform } from './platforms'

/** Mirrors main-process CompleteSystem for preload typing (subset is fine for IPC). */
export type CompleteSystemInfo = {
  id: string
  name: string
  buildType: 'custom' | 'factory'
  platform: Platform
  actionId: string
  barrelId: string
  chassisId: string
  opticId: string | null
  suppressorId: string | null
  laserIrId: string | null
  lightId: string | null
  miscPartIds: string[]
  imageUrl: string | null
  imageScale: number | null
  notes: string | null
  factoryManufacturer: string | null
  factoryModel: string | null
  factoryCartridge: string | null
  factoryActionMaintenance: number | null
  factoryBarrelMaintenance: number | null
  createdAt: string
  updatedAt: string
}

export type CustomSystemInputInfo = {
  id?: string
  name: string
  platform: Platform
  actionId: string
  barrelId: string
  chassisId: string
  opticId?: string | null
  suppressorId?: string | null
  laserIrId?: string | null
  lightId?: string | null
  miscPartIds?: string[]
  imageUrl?: string | null
  imageScale?: number | null
  notes?: string | null
}

export type FactorySystemInputInfo = {
  id?: string
  name: string
  platform: Platform
  factoryManufacturer: string
  factoryModel: string
  factoryCartridge: string
  factoryActionMaintenance?: number
  factoryBarrelMaintenance?: number
  opticId?: string | null
  suppressorId?: string | null
  laserIrId?: string | null
  lightId?: string | null
  miscPartIds?: string[]
  imageUrl?: string | null
  imageScale?: number | null
  notes?: string | null
}
