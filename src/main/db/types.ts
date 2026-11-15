/**
 * Domain types mirroring software-spec §3, adapted for single-user local-first.
 */

export type Platform = 'bolt_action' | 'ar_pattern' | 'pistol'

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
export type BuildType = 'custom' | 'factory'
export type SessionType = 'Practice' | 'Match'
export type AmmoType = 'Factory' | 'Handload'
export type BackupLogType = 'Full' | 'User'
export type BackupLogStatus = 'Success' | 'Failed'
export type LicenseTier = 'free' | 'paid'
export type CompetitionSeries = 'PRS' | 'NRL' | 'NRL22' | 'ELR' | 'Other'

export type Profile = {
  id: string
  /** Local identity (first-run); empty until the user sets one. */
  username: string
  firstName: string
  lastName: string
  email: string | null
  city: string
  state: string
  country: string
  competitionSeries: CompetitionSeries[]
  profileImageUrl: string | null
  trackValue: boolean
  trackAmmo: boolean
  unlockPinSet: boolean
  createdAt: string
  updatedAt: string
}

export type Part = {
  id: string
  manufacturer: string
  value: number
  type: PartType
  status: PartStatus
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

export type CompleteSystem = {
  id: string
  name: string
  buildType: BuildType
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

export type ShootingLog = {
  id: string
  systemId: string
  barrelId: string
  ammoId: string | null
  cartridge: string | null
  date: string
  location: string
  roundsFired: number
  velocity: number | null
  sessionType: SessionType
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type LoadDevelopment = {
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

export type AmmoInventory = {
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

export type BackupSettings = {
  autoBackupEnabled: boolean
  backupIntervalHours: number
  provider: string | null
  lastBackupTime: string | null
  nextBackupTime: string | null
  updatedAt: string
}

export type BackupLogRecord = {
  id: string
  timestamp: string
  type: BackupLogType
  targetUserEmail: string | null
  status: BackupLogStatus
  fileName: string
  fileSize: string
  recordCount: Record<string, number>
  localPath: string | null
  errorMessage: string | null
  createdAt: string
}

export type LicenseState = {
  tier: LicenseTier
  keyPresent: boolean
  keyFingerprint: string | null
  activatedAt: string | null
  updatedAt: string
}

export type DatabaseHealth = {
  ready: boolean
  path: string
  cipher: 'sqlcipher'
  migrationVersion: number
  encrypted: true
}

export type NewShootingLogInput = {
  id?: string
  systemId: string
  ammoId?: string | null
  cartridge?: string | null
  date: string
  location: string
  roundsFired: number
  velocity?: number | null
  sessionType?: SessionType
  notes?: string | null
}

export type UpdateShootingLogInput = Partial<Omit<NewShootingLogInput, 'id'>> & { id: string }

export type FactorySystemInput = {
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

export type CustomSystemInput = {
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
