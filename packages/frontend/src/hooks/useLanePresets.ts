import { useState, useEffect, useCallback } from 'react'
import type { LanePreset, LaneLayout } from '@eigen/shared-types'

interface UseLanePresetsReturn {
  presets: LanePreset[]
  loading: boolean
  fetchPresets: () => void
  createPreset: (name: string, layout: LaneLayout) => Promise<LanePreset>
  updatePreset: (id: string, data: Partial<Pick<LanePreset, 'name' | 'layout'>>) => Promise<LanePreset>
  deletePreset: (id: string) => Promise<void>
}

export function useLanePresets(): UseLanePresetsReturn {
  const [presets, setPresets] = useState<LanePreset[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)

  const fetchPresets = useCallback(() => {
    setRefreshTick((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/lane-presets')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as LanePreset[]
        if (!cancelled) setPresets(data)
      } catch (err) {
        console.error('[useLanePresets] fetch failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [refreshTick])

  const createPreset = useCallback(async (name: string, layout: LaneLayout): Promise<LanePreset> => {
    const res = await fetch('/api/lane-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, layout }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Create lane preset failed (HTTP ${res.status}): ${text}`)
    }
    const created = (await res.json()) as LanePreset
    fetchPresets()
    return created
  }, [fetchPresets])

  const updatePreset = useCallback(async (
    id: string,
    data: Partial<Pick<LanePreset, 'name' | 'layout'>>
  ): Promise<LanePreset> => {
    const res = await fetch(`/api/lane-presets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Update lane preset failed (HTTP ${res.status}): ${text}`)
    }
    const updated = (await res.json()) as LanePreset
    fetchPresets()
    return updated
  }, [fetchPresets])

  const deletePreset = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/lane-presets/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Delete lane preset failed (HTTP ${res.status}): ${text}`)
    }
    fetchPresets()
  }, [fetchPresets])

  return { presets, loading, fetchPresets, createPreset, updatePreset, deletePreset }
}
