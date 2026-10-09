import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { DATA_ROOT } from '../index.ts'

/**
 * User-editable app settings (D-09, D-11), persisted as settings.json under DATA_ROOT
 * (Electron userData in packaged mode).
 *
 * SECURITY TRADEOFF (T-15-71): hfToken is a bearer secret stored as plaintext JSON. It lives under
 * %APPDATA%\Eigen, protected by the Windows user-profile ACL (single-user local app), is never
 * returned by GET /api/settings, and the file is written with mode 0600 where supported.
 * Electron safeStorage encryption-at-rest is recorded as follow-up hardening: this backend is a
 * plain-Node child process with no safeStorage access, and D-02 keeps settings traffic over HTTP.
 */
export interface AppSettings {
  hfToken?: string
  mediaRoot?: string
}

export interface AppConfig {
  getSetting<K extends keyof AppSettings>(key: K): AppSettings[K]
  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K] | undefined): void
  getAll(): AppSettings
}

declare module 'fastify' {
  interface FastifyInstance {
    appConfig: AppConfig
  }
}

const KNOWN_KEYS: ReadonlyArray<keyof AppSettings> = ['hfToken', 'mediaRoot']

function readSettingsFile(file: string): AppSettings {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: AppSettings = {}
    for (const key of KNOWN_KEYS) {
      const v = (parsed as Record<string, unknown>)[key]
      if (typeof v === 'string' && v.length > 0) out[key] = v
    }
    return out
  } catch {
    // Missing or corrupt file: start from defaults rather than failing backend startup
    return {}
  }
}

/** Atomic write: temp file in the same directory, then rename over the target. */
function writeSettingsFile(file: string, settings: AppSettings): void {
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmp, file)
}

export function createAppConfig(file: string): AppConfig {
  let cache = readSettingsFile(file)
  return {
    getSetting: (key) => cache[key],
    setSetting: (key, value) => {
      const next = { ...cache }
      if (value === undefined || value === '') delete next[key]
      else next[key] = value
      writeSettingsFile(file, next)
      cache = next
    },
    getAll: () => ({ ...cache }),
  }
}

async function appConfigPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorate('appConfig', createAppConfig(path.join(DATA_ROOT, 'settings.json')))
}

export default fp(appConfigPlugin)
