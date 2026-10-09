// Electron main process: single-instance lock, instant splash, health-gated main window,
// graceful-then-tree-kill backend shutdown (D-01, D-03, D-04, D-05).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ChildProcess } from 'node:child_process'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import log from 'electron-log/main'
import {
  BACKEND_HOST,
  BACKEND_PORT,
  buildBackendEnv,
  readSavedMediaRoot,
  resolveDataRoot,
  resolveMediaRoot,
  resolvePackagedPaths,
} from './config.ts'
import { shutdownBackend, startBackend, waitForBackendHealth } from './backend-process.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Main window loads the backend-served SPA at http://127.0.0.1:3001 (D-04); relative /api fetches work untouched.
const APP_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`

// Stable userData folder (%APPDATA%\Eigen) regardless of package name (D-11). Must precede the
// single-instance lock, which keys off userData.
app.setPath('userData', path.join(app.getPath('appData'), 'Eigen'))
log.initialize()

let splashWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null
let backendProc: ChildProcess | null = null
let shutdownComplete = false
let shutdownStarted = false

// --- Single-instance lock (D-03): a second launch never spawns a second backend on the port ---
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = mainWindow ?? splashWindow
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.whenReady().then(boot).catch((err) => void fail(err))
}

function createSplash(): BrowserWindow {
  const win = new BrowserWindow({
    width: 360,
    height: 200,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    center: true,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: false,
    backgroundColor: '#2e2e2e',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.once('ready-to-show', () => win.show())
  void win.loadFile(path.join(__dirname, 'splash', 'index.html'))
  return win
}

function setSplashStatus(message: string, isError = false): void {
  if (!splashWindow || splashWindow.isDestroyed()) return
  const text = JSON.stringify(message)
  void splashWindow.webContents
    .executeJavaScript(
      `(() => { const el = document.getElementById('status'); if (!el) return;` +
        ` el.textContent = ${text}; el.classList.toggle('splash__status--error', ${isError}); })()`,
    )
    .catch(() => {
      /* splash may still be loading; the next status update will land */
    })
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#1a1a1a',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Sandboxed preloads must be plain CommonJS.
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })
  win.once('ready-to-show', () => win.show())

  // The window only ever shows first-party localhost content.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== APP_URL) event.preventDefault()
  })

  win.on('closed', () => {
    mainWindow = null
  })
  void win.loadURL(APP_URL)
  return win
}

async function boot(): Promise<void> {
  splashWindow = createSplash()

  const userDataDir = app.getPath('userData')
  const dataRoot = resolveDataRoot(userDataDir)
  // Media root chosen in Settings (D-11) lives in the backend's settings.json; it is read here
  // at launch because the backend resolves MEDIA_ROOT once, so changes apply on next start.
  const mediaRoot = resolveMediaRoot(userDataDir, readSavedMediaRoot(dataRoot))

  const packaged = app.isPackaged ? resolvePackagedPaths(process.resourcesPath, userDataDir) : null
  const backendEntry = packaged?.backendEntry ?? path.resolve(__dirname, '../../backend/src/index.ts')

  const env = buildBackendEnv({
    dataRoot,
    mediaRoot,
    parentPid: process.pid,
    port: BACKEND_PORT,
    host: BACKEND_HOST,
    isPackaged: app.isPackaged,
    venvPython: packaged?.venvPython,
    ffmpegPath: packaged?.ffmpegPath,
    ffprobePath: packaged?.ffprobePath,
    uvPath: packaged?.uvPath,
    remotionBundleDir: packaged?.remotionBundleDir,
    frontendDist: packaged?.frontendDist,
  })

  log.info(`[main] boot packaged=${app.isPackaged} dataRoot=${dataRoot} mediaRoot=${mediaRoot}`)
  setSplashStatus('Starting backend…')

  const proc = startBackend({
    backendEntry,
    env,
    // Dev only: native modules are built for the system Node ABI, not Electron's.
    nodeBinary: app.isPackaged ? undefined : process.env.EIGEN_DEV_NODE,
  })
  backendProc = proc

  await waitForBackendHealth(
    BACKEND_PORT,
    setSplashStatus,
    30_000,
    () => (proc.exitCode !== null || proc.signalCode !== null ? `exit code ${proc.exitCode ?? proc.signalCode}` : null),
  )

  // Open the main window first, then close the splash, so window-all-closed never fires in between.
  mainWindow = createMainWindow()
  const splash = splashWindow
  splashWindow = null
  mainWindow.once('ready-to-show', () => {
    if (splash && !splash.isDestroyed()) splash.destroy()
  })
}

async function fail(err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  log.error('[main] startup failed', err)
  setSplashStatus(`Startup failed: ${message}`, true)
  splashWindow?.setAlwaysOnTop(false)
  await dialog.showMessageBox({
    type: 'error',
    title: 'Eigen Video Editor',
    message: 'Eigen failed to start',
    detail: `${message}\n\nSee the log file under ${app.getPath('logs')} for details.`,
  })
  app.quit()
}

// --- Native folder picker: the sole IPC surface (media-root setting, Plan 07) ---
ipcMain.handle('eigen:choose-folder', async (event) => {
  const parent = BrowserWindow.fromWebContents(event.sender)
  const options: Electron.OpenDialogOptions = { properties: ['openDirectory', 'createDirectory'] }
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
})

// --- Shutdown (D-03, Pattern 3): graceful signal, bounded wait, then tree-kill ---
app.on('before-quit', (event) => {
  if (shutdownComplete || !backendProc) return
  event.preventDefault()
  if (shutdownStarted) return
  shutdownStarted = true
  void shutdownBackend(backendProc, 5000).finally(() => {
    shutdownComplete = true
    app.exit()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
