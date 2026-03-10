import { useState, useEffect, useCallback } from 'react'
import type { AnimationPreset } from '@eigen/shared-types'

interface UseAnimationPresetsReturn {
  presets: AnimationPreset[]
  loading: boolean
  error: string | null
  refresh: () => void
  createPreset: (preset: Omit<AnimationPreset, 'id' | 'isBuiltin' | 'createdAt' | 'updatedAt'>) => Promise<AnimationPreset>
  updatePreset: (id: string, patch: Partial<Pick<AnimationPreset, 'name' | 'scope' | 'enter' | 'active' | 'exit'>>) => Promise<AnimationPreset>
  deletePreset: (id: string) => Promise<void>
  duplicatePreset: (id: string) => Promise<AnimationPreset>
}

export function useAnimationPresets(): UseAnimationPresetsReturn {
  const [presets, setPresets] = useState<AnimationPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const refresh = useCallback(() => {
    setRefreshTick((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchPresets() {
      setLoading(true)
      try {
        const res = await fetch('/api/presets')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as AnimationPreset[]
        if (!cancelled) {
          setPresets(data)
          setError(null)
        }
      } catch (err) {
        console.error('[useAnimationPresets] fetch failed:', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load presets')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchPresets()
    return () => { cancelled = true }
  }, [refreshTick])

  const createPreset = useCallback(async (
    preset: Omit<AnimationPreset, 'id' | 'isBuiltin' | 'createdAt' | 'updatedAt'>
  ): Promise<AnimationPreset> => {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preset),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Create preset failed (HTTP ${res.status}): ${text}`)
    }
    const created = (await res.json()) as AnimationPreset
    refresh()
    return created
  }, [refresh])

  const updatePreset = useCallback(async (
    id: string,
    patch: Partial<Pick<AnimationPreset, 'name' | 'scope' | 'enter' | 'active' | 'exit'>>
  ): Promise<AnimationPreset> => {
    const res = await fetch(`/api/presets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Update preset failed (HTTP ${res.status}): ${text}`)
    }
    const updated = (await res.json()) as AnimationPreset
    refresh()
    return updated
  }, [refresh])

  const deletePreset = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/presets/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Delete preset failed (HTTP ${res.status}): ${text}`)
    }
    refresh()
  }, [refresh])

  const duplicatePreset = useCallback(async (id: string): Promise<AnimationPreset> => {
    const res = await fetch(`/api/presets/${id}/duplicate`, { method: 'POST' })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Duplicate preset failed (HTTP ${res.status}): ${text}`)
    }
    const duplicated = (await res.json()) as AnimationPreset
    refresh()
    return duplicated
  }, [refresh])

  return {
    presets,
    loading,
    error,
    refresh,
    createPreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
  }
}
