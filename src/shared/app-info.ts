import type { LicenseStatusInfo } from './license'

export type { LicenseStatusInfo } from './license'

export type DatabaseHealthInfo = {
  ready: boolean
  path: string
  cipher: 'sqlcipher'
  migrationVersion: number
  encrypted: true
}

export type AppInfo = {
  name: string
  env: string
  backupProvider: string
  license: LicenseStatusInfo
}
