export type DatabaseHealthInfo = {
  ready: boolean
  path: string
  cipher: 'sqlcipher'
  migrationVersion: number
  encrypted: true
}

export type AppInfo = {
  name: string
  version: string
  env: string
  backupProvider: string
}
