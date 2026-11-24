/**
 * Materiel JSON import document (v1).
 * Used by Settings → Import and by the Excel→JSON Claude prompt.
 */

import type { PartType } from './parts'
import type { Platform } from './platforms'
import type { SessionType } from './shooting-logs'

export const MATERIEL_IMPORT_VERSION = 1 as const

export type MaterielImportPart = {
  /** Stable id used by builds/logs in this file (not necessarily a UUID). */
  id: string
  type: PartType
  manufacturer: string
  model?: string | null
  /** Required for Barrel (or synthesized from model/caliber). */
  name?: string | null
  /** Required for Barrel and Frame/Pistol. */
  caliber?: string | null
  gunsmith?: string | null
  serialNumber?: string | null
  platforms?: Platform[]
  totalRoundCount?: number
  roundsAfterCleaning?: number
  maintenanceInterval?: number | null
  twistRate?: number | null
  barrelLife?: number | null
  value?: number
  notes?: string | null
}

export type MaterielImportBuild = {
  id?: string
  name: string
  platform?: Platform
  actionId: string
  barrelId: string
  /** Omit to use the shared placeholder chassis (bolt) / auto furniture. */
  chassisId?: string
  opticId?: string
  suppressorId?: string
  notes?: string | null
}

export type MaterielImportLog = {
  /** Prefer an explicit build id from `builds`. */
  buildId?: string
  /** Or resolve build by action+barrel pairing. */
  actionId?: string
  barrelId?: string
  date: string
  location: string
  roundsFired: number
  sessionType?: SessionType
  cartridge?: string | null
  velocity?: number | null
  placement?: number | null
  percentOfWinner?: number | null
  ammoId?: string | null
  notes?: string | null
}

export type MaterielImportAmmo = {
  id?: string
  name?: string
  type: 'Factory' | 'Handload'
  caliber: string
  quantity: number
  acquiredDate: string
  manufacturer?: string | null
  lotNumber?: string | null
  bulletManufacturer?: string | null
  powderManufacturer?: string | null
  primerManufacturer?: string | null
  caseManufacturer?: string | null
  notes?: string | null
}

export type MaterielImportOptions = {
  /**
   * When builds need a chassis/furniture part and none is provided,
   * create one shared placeholder Chassis (bolt) — default true.
   */
  createPlaceholderChassis?: boolean
  /**
   * When `builds` is empty and the file has Actions + Barrels,
   * pair them 1:1 in document order — default false (prefer explicit builds).
   */
  autoPairBuilds?: boolean
  /** Default platform for imported builds — default bolt_action. */
  defaultPlatform?: Platform
  placeholderChassis?: {
    manufacturer?: string
    model?: string
  }
}

export type MaterielImportDocument = {
  version: typeof MATERIEL_IMPORT_VERSION
  options?: MaterielImportOptions
  parts: MaterielImportPart[]
  builds?: MaterielImportBuild[]
  logs?: MaterielImportLog[]
  ammo?: MaterielImportAmmo[]
}

export type MaterielImportSummary = {
  partsCreated: number
  buildsCreated: number
  logsCreated: number
  ammoCreated: number
  placeholderChassisId: string | null
  warnings: string[]
}

export type MaterielImportResult =
  | { ok: true; summary: MaterielImportSummary }
  | { ok: false; error: string }
