import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppInfo, DatabaseHealthInfo } from '../shared/app-info'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getAppInfo: () => Promise<AppInfo>
      getDatabaseHealth: () => Promise<DatabaseHealthInfo>
    }
  }
}

export {}
