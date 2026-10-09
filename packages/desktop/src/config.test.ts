import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildBackendEnv, readSavedMediaRoot, resolveDataRoot, resolveMediaRoot, resolvePackagedPaths } from './config.ts'

const userData = path.join(path.sep, 'users', 'me', 'AppData', 'Roaming', 'Eigen')

describe('resolveDataRoot', () => {
  it('is rooted under the userData dir', () => {
    const root = resolveDataRoot(userData)
    expect(root.startsWith(userData)).toBe(true)
    expect(root).not.toBe(userData)
  })
})

describe('resolveMediaRoot', () => {
  it('defaults to <userData>/media', () => {
    expect(resolveMediaRoot(userData)).toBe(path.join(userData, 'media'))
  })
  it('falls back to the default for null/blank overrides', () => {
    expect(resolveMediaRoot(userData, null)).toBe(path.join(userData, 'media'))
    expect(resolveMediaRoot(userData, '   ')).toBe(path.join(userData, 'media'))
  })
  it('honors an override', () => {
    expect(resolveMediaRoot(userData, 'D:\\BigDrive\\eigen-media')).toBe('D:\\BigDrive\\eigen-media')
  })
})

describe('buildBackendEnv', () => {
  const base = { dataRoot: '/d', mediaRoot: '/m', parentPid: 4242, baseEnv: { PATH: '/bin' } }

  it('always sets localhost host, port, node mode and parent pid', () => {
    const env = buildBackendEnv(base)
    expect(env.HOST).toBe('127.0.0.1')
    expect(env.PORT).toBe('3001')
    expect(env.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(env.PARENT_PID).toBe('4242')
    expect(env.DATA_ROOT).toBe('/d')
    expect(env.MEDIA_ROOT).toBe('/m')
    expect(env.PATH).toBe('/bin')
  })

  it('omits packaged-only vars when not provided', () => {
    const env = buildBackendEnv({ ...base, baseEnv: { IS_PACKAGED: '1' } })
    for (const k of ['IS_PACKAGED', 'VENV_PYTHON', 'FFMPEG_PATH', 'FFPROBE_PATH', 'UV_PATH', 'REMOTION_BUNDLE_DIR', 'FRONTEND_DIST']) {
      expect(env[k]).toBeUndefined()
    }
  })

  it('injects packaged binary paths when provided', () => {
    const env = buildBackendEnv({
      ...base,
      isPackaged: true,
      venvPython: 'py.exe',
      ffmpegPath: 'ffmpeg.exe',
      ffprobePath: 'ffprobe.exe',
      uvPath: 'uv.exe',
      remotionBundleDir: 'bundle',
      frontendDist: 'dist',
    })
    expect(env.IS_PACKAGED).toBe('1')
    expect(env.VENV_PYTHON).toBe('py.exe')
    expect(env.FFMPEG_PATH).toBe('ffmpeg.exe')
    expect(env.FFPROBE_PATH).toBe('ffprobe.exe')
    expect(env.UV_PATH).toBe('uv.exe')
    expect(env.REMOTION_BUNDLE_DIR).toBe('bundle')
    expect(env.FRONTEND_DIST).toBe('dist')
  })
})

describe('resolvePackagedPaths', () => {
  const res = path.join(path.sep, 'app', 'resources')
  const p = resolvePackagedPaths(res, userData)

  it('places shipped assets under resourcesPath', () => {
    expect(p.backendEntry).toBe(path.join(res, 'backend', 'src', 'index.ts'))
    expect(p.ffmpegPath).toBe(path.join(res, 'bin', 'ffmpeg.exe'))
    expect(p.ffprobePath).toBe(path.join(res, 'bin', 'ffprobe.exe'))
    expect(p.uvPath).toBe(path.join(res, 'bin', 'uv.exe'))
    expect(p.remotionBundleDir).toBe(path.join(res, 'remotion-bundle'))
    expect(p.frontendDist).toBe(path.join(res, 'frontend', 'dist'))
  })

  it('puts the venv python under userData, not resources', () => {
    expect(p.venvPython.startsWith(userData)).toBe(true)
    expect(p.venvPython.endsWith(path.join('Scripts', 'python.exe'))).toBe(true)
  })
})

describe('readSavedMediaRoot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eigen-cfg-'))
  const settings = path.join(dir, 'settings.json')

  it('returns null when settings.json is missing', () => {
    expect(readSavedMediaRoot(path.join(dir, 'nope'))).toBeNull()
  })
  it('returns null for corrupt JSON or a non-string value', () => {
    fs.writeFileSync(settings, '{not json')
    expect(readSavedMediaRoot(dir)).toBeNull()
    fs.writeFileSync(settings, JSON.stringify({ mediaRoot: 5 }))
    expect(readSavedMediaRoot(dir)).toBeNull()
  })
  it('returns null for a relative path or a path that is not an existing directory', () => {
    fs.writeFileSync(settings, JSON.stringify({ mediaRoot: 'relative/dir' }))
    expect(readSavedMediaRoot(dir)).toBeNull()
    fs.writeFileSync(settings, JSON.stringify({ mediaRoot: path.join(dir, 'gone') }))
    expect(readSavedMediaRoot(dir)).toBeNull()
  })
  it('returns the saved directory when it exists', () => {
    fs.writeFileSync(settings, JSON.stringify({ mediaRoot: dir, hfToken: 'hf_x' }))
    expect(readSavedMediaRoot(dir)).toBe(dir)
  })
})
