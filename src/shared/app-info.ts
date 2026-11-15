export type LicenseStatusInfo = {
  tier: 'free' | 'paid'
  freeRifleLimit: number
  completeRifleCount: number
  canCreateRifle: boolean
  keyPresent: boolean
}

export type AppInfo = {
  name: string
  env: string
  backupProvider: string
  license: LicenseStatusInfo
}
