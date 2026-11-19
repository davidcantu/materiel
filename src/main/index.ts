import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  closeDatabase,
  getDatabasePath,
  getHealth,
  initDatabase,
  toDatabaseInitFailure,
  buildDatabaseInitFailureHtml,
  type DatabaseInitFailure
} from './db'
import { promptDatabaseInitFailure } from './db-init-failure'
import { initBackupSubsystem } from './backup'
import { registerSystemsIpc } from './systems/ipc'
import { registerPartsIpc } from './parts/ipc'
import { registerLogsIpc } from './logs/ipc'
import { registerAmmoIpc } from './ammo/ipc'
import { registerDashboardIpc } from './dashboard/ipc'
import { registerImportIpc } from './import/ipc'
import { initUpdateChecker } from './updates'
import { registerUpdatesIpc } from './updates/ipc'
import { safeOpenExternal } from './security/open-external'

type CreateWindowOptions = {
  initFailure?: DatabaseInitFailure | null
}

function createWindow(options: CreateWindowOptions = {}): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Materiel',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // If the renderer never paints (rare), still surface the window so we do not hang blank.
  const showFallback = setTimeout(() => {
    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  }, 4000)
  mainWindow.once('closed', () => clearTimeout(showFallback))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void safeOpenExternal(details.url).catch((error) => {
      console.warn('[app] blocked or failed openExternal:', error)
    })
    return { action: 'deny' }
  })

  if (options.initFailure) {
    const html = buildDatabaseInitFailureHtml(options.initFailure)
    void mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  } else if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function registerDomainIpc(): void {
  registerSystemsIpc()
  registerPartsIpc()
  registerLogsIpc()
  registerAmmoIpc()
  registerDashboardIpc()
  registerImportIpc()
}

function registerMinimalFailureIpc(failure: DatabaseInitFailure): void {
  ipcMain.handle('app:get-info', () => ({
    name: 'Materiel',
    version: app.getVersion(),
    env: process.env.MAIN_VITE_APP_ENV ?? import.meta.env.MODE,
    backupProvider: 'unavailable'
  }))

  ipcMain.handle('db:health', () => ({
    ready: false,
    path: failure.dbPath,
    cipher: 'sqlcipher' as const,
    migrationVersion: 0,
    encrypted: true as const
  }))
}

app
  .whenReady()
  .then(async () => {
    electronApp.setAppUserModelId('com.davidcantu.materiel')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    let initFailure: DatabaseInitFailure | null = null

    try {
      initDatabase()
    } catch (error) {
      initFailure = toDatabaseInitFailure(error, { dbPath: getDatabasePath() })
      console.error('[db] init failed — data was not deleted', initFailure)
    }

    if (initFailure) {
      registerMinimalFailureIpc(initFailure)
      const window = createWindow({ initFailure })
      app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow({ initFailure })
        }
      })
      await promptDatabaseInitFailure(initFailure, { parent: window })
      return
    }

    const backupProvider = initBackupSubsystem()
    registerDomainIpc()

    ipcMain.handle('app:get-info', () => ({
      name: 'Materiel',
      version: app.getVersion(),
      env: process.env.MAIN_VITE_APP_ENV ?? import.meta.env.MODE,
      backupProvider: backupProvider.id
    }))

    ipcMain.handle('db:health', () => getHealth())

    registerUpdatesIpc()

    createWindow()

    // Soft GitHub Releases check: prompt when a newer tag exists; no-op offline.
    initUpdateChecker()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  .catch((error) => {
    // Last-resort: never leave only UnhandledPromiseRejection as the signal.
    console.error('[app] startup failed', error)
    const failure = toDatabaseInitFailure(error, { dbPath: '' })
    void promptDatabaseInitFailure(failure).finally(() => {
      app.quit()
    })
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  closeDatabase()
})
