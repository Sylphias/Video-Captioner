import { useState, useEffect, useCallback } from 'react'
import type { LookStyleProps } from '@eigen/remotion-composition'

// Global event target so all hook instances refresh when any one mutates
const textStylesChanged = new EventTarget()
function notifyTextStylesChanged() {
  textStylesChanged.dispatchEvent(new Event('change'))
}

export interface TextStyle {
  id: string
  name: string
  isBuiltin: boolean
  props: LookStyleProps
  createdAt: number
  updatedAt: number
}

export interface TextStyleInput {
  name: string
  props: LookStyleProps
}

interface UseTextStylesReturn {
  styles: TextStyle[]
  loading: boolean
  error: string | null
  refresh: () => void
  createStyle: (input: TextStyleInput) => Promise<TextStyle>
  updateStyle: (id: string, patch: { name?: string; props?: LookStyleProps }) => Promise<TextStyle>
  deleteStyle: (id: string) => Promise<void>
  duplicateStyle: (id: string) => Promise<TextStyle>
}

export function useTextStyles(): UseTextStylesReturn {
  const [styles, setStyles] = useState<TextStyle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const refresh = useCallback(() => {
    setRefreshTick((n) => n + 1)
  }, [])

  // Listen for changes from other hook instances
  useEffect(() => {
    const handler = () => refresh()
    textStylesChanged.addEventListener('change', handler)
    return () => textStylesChanged.removeEventListener('change', handler)
  }, [refresh])

  useEffect(() => {
    let cancelled = false

    async function fetchStyles() {
      setLoading(true)
      try {
        const res = await fetch('/api/styles')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as TextStyle[]
        if (!cancelled) {
          setStyles(data)
          setError(null)
        }
      } catch (err) {
        console.error('[useTextStyles] fetch failed:', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load styles')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchStyles()
    return () => { cancelled = true }
  }, [refreshTick])

  // Mutation callbacks have empty deps (stable identities) so consumers can hold
  // them in refs / effect deps without re-running (Studio auto-save relies on this).
  const createStyle = useCallback(async (input: TextStyleInput): Promise<TextStyle> => {
    const res = await fetch('/api/styles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Create style failed (HTTP ${res.status}): ${text}`)
    }
    const created = (await res.json()) as TextStyle
    notifyTextStylesChanged()
    return created
  }, [])

  const updateStyle = useCallback(async (
    id: string,
    patch: { name?: string; props?: LookStyleProps },
  ): Promise<TextStyle> => {
    const res = await fetch(`/api/styles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Update style failed (HTTP ${res.status}): ${text}`)
    }
    const updated = (await res.json()) as TextStyle
    notifyTextStylesChanged()
    return updated
  }, [])

  const deleteStyle = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/styles/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Delete style failed (HTTP ${res.status}): ${text}`)
    }
    notifyTextStylesChanged()
  }, [])

  const duplicateStyle = useCallback(async (id: string): Promise<TextStyle> => {
    const res = await fetch(`/api/styles/${id}/duplicate`, { method: 'POST' })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Duplicate style failed (HTTP ${res.status}): ${text}`)
    }
    const duplicated = (await res.json()) as TextStyle
    notifyTextStylesChanged()
    return duplicated
  }, [])

  return {
    styles,
    loading,
    error,
    refresh,
    createStyle,
    updateStyle,
    deleteStyle,
    duplicateStyle,
  }
}
