/**
 * App settings client (D-09, D-11). Unlike transcriptionPrefs (localStorage), these live in the
 * backend's settings.json under userData, so the backend is the source of truth and every call
 * goes through /api/settings. The raw HuggingFace token is write-only: the backend only reports
 * whether one is saved.
 */

/** Bridge exposed by the Electron preload (packages/desktop/src/preload.cjs). Absent in a plain browser. */
declare global {
  interface Window {
    eigen?: {
      chooseFolder: () => Promise<string | null>
    }
  }
}

export interface AppSettingsView {
  /** Folder the user has chosen (or the one in use when none is saved). */
  mediaRoot: string
  /** Folder the running backend is actually using; differs from mediaRoot until the app restarts. */
  activeMediaRoot: string
  hasToken: boolean
}

export interface SettingsUpdate {
  /** Omit to leave unchanged; '' clears the saved token. */
  hfToken?: string
  mediaRoot?: string
}

/** Thrown for backend validation failures; message is user-facing UI-SPEC copy. */
export class SettingsValidationError extends Error {
  field: 'hfToken' | 'mediaRoot' | null
  constructor(message: string, field: 'hfToken' | 'mediaRoot' | null) {
    super(message)
    this.name = 'SettingsValidationError'
    this.field = field
  }
}

export async function loadSettings(): Promise<AppSettingsView> {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error(`Failed to load settings (HTTP ${res.status})`)
  return (await res.json()) as AppSettingsView
}

export async function saveSettings(update: SettingsUpdate): Promise<AppSettingsView> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
  if (res.status === 400) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; field?: 'hfToken' | 'mediaRoot' }
    throw new SettingsValidationError(body.error ?? 'Invalid settings', body.field ?? null)
  }
  if (!res.ok) throw new Error(`Failed to save settings (HTTP ${res.status})`)
  return (await res.json()) as AppSettingsView
}
