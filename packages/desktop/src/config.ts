// Pure, Electron-free path/env derivation for the desktop shell (D-11, D-12).
// Everything takes userDataDir as a parameter so it can be unit-tested without launching Electron.
import fs from 'node:fs'
import path from 'node:path'

export const BACKEND_PORT = 3001
export const BACKEND_HOST = '127.0.0.1'

/** Settings + SQLite DBs live directly under Electron's userData dir (D-11). */
export function resolveDataRoot(userDataDir: string): string {
  return path.join(userDataDir, 'data')
}

/**
 * Heavy media root (uploads/renders/thumbnails/job dirs). Defaults to <userData>/media and is
 * user-redirectable to a big drive via `override` (D-11). Blank overrides fall back to the default.
 */
export function resolveMediaRoot(userDataDir: string, override?: string | null): string {
  const trimmed = override?.trim()
  if (trimmed) return trimmed
  return path.join(userDataDir, 'media')
}

/**
 * Media-root the user chose in Settings (D-11), read from the backend's settings.json at launch.
 * The backend resolves MEDIA_ROOT once at startup, so a change takes effect on the next launch.
 * Returns null when no usable value is saved (missing/corrupt file, non-string, not a directory).
 */
export function readSavedMediaRoot(dataRoot: string): string | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dataRoot, 'settings.json'), 'utf8'))
    const value = (parsed as { mediaRoot?: unknown } | null)?.mediaRoot
    if (typeof value !== 'string' || !path.isAbsolute(value.trim())) return null
    return fs.statSync(value.trim()).isDirectory() ? value.trim() : null
  } catch {
    return null
  }
}

export interface BackendEnvOptions {
  dataRoot: string
  mediaRoot: string
  /** PID of the Electron main process; backend self-exits if it vanishes (D-03 watchdog). */
  parentPid: number
  port?: number
  host?: string
  isPackaged?: boolean
  /** Packaged-mode binary/path injections (only set when provided). */
  venvPython?: string
  ffmpegPath?: string
  ffprobePath?: string
  uvPath?: string
  remotionBundleDir?: string
  frontendDist?: string
  /** Directory holding the shipped Python scripts (transcribe.py/diarize.py). */
  scriptsDir?: string
  /** Environment to inherit (PATH, SystemRoot, ...). Defaults to process.env. */
  baseEnv?: NodeJS.ProcessEnv
}

/**
 * Env for the spawned backend child. ELECTRON_RUN_AS_NODE=1 makes process.execPath (Electron)
 * behave as plain Node so the existing backend TS runs with no build step (D-02, Pattern 1).
 */
export function buildBackendEnv(opts: BackendEnvOptions): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...(opts.baseEnv ?? process.env),
    ELECTRON_RUN_AS_NODE: '1',
    DATA_ROOT: opts.dataRoot,
    MEDIA_ROOT: opts.mediaRoot,
    PORT: String(opts.port ?? BACKEND_PORT),
    HOST: opts.host ?? BACKEND_HOST,
    PARENT_PID: String(opts.parentPid),
  }
  if (opts.isPackaged) env.IS_PACKAGED = '1'
  else delete env.IS_PACKAGED
  if (opts.venvPython) env.VENV_PYTHON = opts.venvPython
  if (opts.ffmpegPath) env.FFMPEG_PATH = opts.ffmpegPath
  if (opts.ffprobePath) env.FFPROBE_PATH = opts.ffprobePath
  if (opts.uvPath) env.UV_PATH = opts.uvPath
  if (opts.remotionBundleDir) env.REMOTION_BUNDLE_DIR = opts.remotionBundleDir
  if (opts.frontendDist) env.FRONTEND_DIST = opts.frontendDist
  if (opts.scriptsDir) env.SCRIPTS_DIR = opts.scriptsDir
  return env
}

export interface PackagedPaths {
  backendEntry: string
  ffmpegPath: string
  ffprobePath: string
  uvPath: string
  remotionBundleDir: string
  frontendDist: string
  /** transcribe.py / diarize.py (the backend's repo-relative lookup does not hold once packaged). */
  scriptsDir: string
  /** Venv is created by first-run setup (D-08) in a userData-writable location, never shipped. */
  venvPython: string
}

/**
 * Packaged-mode resource layout, matching the electron-builder extraResources contract in Plan 08:
 * backend at <resources>/backend, ffmpeg/ffprobe/uv at <resources>/bin, prebuilt Remotion bundle at
 * <resources>/remotion-bundle, Vite dist at <resources>/frontend/dist, Python scripts at <resources>/scripts.
 */
export function resolvePackagedPaths(resourcesPath: string, userDataDir: string): PackagedPaths {
  return {
    backendEntry: path.join(resourcesPath, 'backend', 'src', 'index.ts'),
    ffmpegPath: path.join(resourcesPath, 'bin', 'ffmpeg.exe'),
    ffprobePath: path.join(resourcesPath, 'bin', 'ffprobe.exe'),
    uvPath: path.join(resourcesPath, 'bin', 'uv.exe'),
    remotionBundleDir: path.join(resourcesPath, 'remotion-bundle'),
    frontendDist: path.join(resourcesPath, 'frontend', 'dist'),
    scriptsDir: path.join(resourcesPath, 'scripts'),
    venvPython: path.join(userDataDir, 'venv', 'Scripts', 'python.exe'),
  }
}
