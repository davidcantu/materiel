import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppInfo, DatabaseHealthInfo } from '../shared/app-info'

const api = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:get-info'),
  getDatabaseHealth: (): Promise<DatabaseHealthInfo> => ipcRenderer.invoke('db:health')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
