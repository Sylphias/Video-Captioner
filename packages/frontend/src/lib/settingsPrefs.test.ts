import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSettings, saveSettings, SettingsValidationError } from './settingsPrefs.ts'

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('settingsPrefs', () => {
  it('loadSettings GETs /api/settings', async () => {
    const view = { mediaRoot: 'D:\\media', activeMediaRoot: 'D:\\media', hasToken: true }
    const fetchFn = mockFetch(200, view)
    await expect(loadSettings()).resolves.toEqual(view)
    expect(fetchFn).toHaveBeenCalledWith('/api/settings')
  })

  it('saveSettings PUTs only the provided fields', async () => {
    const fetchFn = mockFetch(200, { mediaRoot: 'x', activeMediaRoot: 'x', hasToken: true })
    await saveSettings({ hfToken: 'hf_abc' })
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/settings')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ hfToken: 'hf_abc' })
  })

  it('surfaces backend 400 copy and field as SettingsValidationError', async () => {
    mockFetch(400, { field: 'mediaRoot', error: 'Folder is not writable — choose a different location.' })
    const err = await saveSettings({ mediaRoot: 'C:\\nope' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SettingsValidationError)
    expect((err as SettingsValidationError).field).toBe('mediaRoot')
    expect((err as SettingsValidationError).message).toBe(
      'Folder is not writable — choose a different location.',
    )
  })

  it('throws a generic error on other failures', async () => {
    mockFetch(500, {})
    await expect(saveSettings({ hfToken: 'hf_abc' })).rejects.toThrow('HTTP 500')
  })
})
