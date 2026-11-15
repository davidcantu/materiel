import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppInfo } from '../shared/app-info'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getAppInfo: () => Promise<AppInfo>
    }
  }
}

export {}
