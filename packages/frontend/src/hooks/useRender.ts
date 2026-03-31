import { useState, useRef, useCallback, useEffect } from 'react'
import type { AnimationPreset } from '@eigen/shared-types'
import { useSubtitleStore } from '../store/subtitleStore.ts'

export interface RenderState {
  status: 'idle' | 'rendering' | 'rendered' | 'failed'
  progress: number // 0-100
  error?: string
}

const INITIAL_STATE: RenderState = {
  status: 'idle',
  progress: 0,
}

export function useRender() {
  const [state, setState] = useState<RenderState>(INITIAL_STATE)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Close EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  const render = useCallback(async (jobId: string) => {
    // Close any existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setState({ status: 'rendering', progress: 0 })

    // Read current state from Zustand store
    const {
      session, style, speakerStyles,
      activeAnimationPresetId, activeHighlightPresetId,
      phraseAnimationPresetIds, phraseLaneOverrides,
    } = useSubtitleStore.getState()

    // Fetch presets to resolve IDs → full objects (composition can't access APIs)
    let presets: AnimationPreset[] = []
    try {
      const presetsRes = await fetch('/api/presets')
      if (presetsRes.ok) presets = (await presetsRes.json()) as AnimationPreset[]
    } catch { /* proceed without presets */ }

    // Resolve global animation preset (same merge logic as PreviewPanel)
    const basePreset = activeAnimationPresetId
      ? presets.find((p) => p.id === activeAnimationPresetId)
      : undefined
    const highlightPreset = activeHighlightPresetId
      ? presets.find((p) => p.id === activeHighlightPresetId)
      : undefined
    const animationPreset = basePreset
      ? {
          ...basePreset,
          ...(highlightPreset?.highlightAnimation ? { highlightAnimation: highlightPreset.highlightAnimation } : {}),
        }
      : undefined

    // Resolve per-phrase animation presets and build composition phrases
    const phrases = (session?.phrases ?? []).map((p, i) => {
      const phrasePresetId = phraseAnimationPresetIds[i]
      const phrasePreset = phrasePresetId ? presets.find((pr) => pr.id === phrasePresetId) : undefined
      return {
        words: p.words,
        dominantSpeaker: p.dominantSpeaker,
        lingerDuration: p.lingerDuration,
        styleOverride: p.styleOverride,
        animationPreset: phrasePreset,
      }
    })

    const laneOverrides = Object.keys(phraseLaneOverrides).length > 0 ? phraseLaneOverrides : undefined

    // POST to trigger the render
    try {
      const res = await fetch(`/api/jobs/${jobId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrases, style, speakerStyles, animationPreset, phraseLaneOverrides: laneOverrides }),
      })
      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`
        try {
          const body = await res.json() as { error?: string }
          if (body.error) errorMsg = body.error
        } catch { /* ignore parse errors */ }
        setState({ status: 'failed', progress: 0, error: errorMsg })
        return
      }
    } catch {
      setState({ status: 'failed', progress: 0, error: 'Network error' })
      return
    }

    // Open SSE connection for progress tracking
    const es = new EventSource(`/api/jobs/${jobId}/status`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      let data: { status: string; progress?: number; error?: string }
      try {
        data = JSON.parse(event.data) as { status: string; progress?: number; error?: string }
      } catch { return }

      if (data.status === 'rendering') {
        setState({ status: 'rendering', progress: data.progress ?? 0 })
      } else if (data.status === 'rendered') {
        es.close()
        eventSourceRef.current = null
        setState({ status: 'rendered', progress: 100 })
      } else if (data.status === 'failed') {
        es.close()
        eventSourceRef.current = null
        setState({ status: 'failed', progress: 0, error: data.error ?? 'Render failed' })
      }
    }

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setState((prev) => {
        if (prev.status === 'rendered' || prev.status === 'failed') return prev
        return { status: 'failed', progress: 0, error: 'Connection to server lost' }
      })
    }
  }, [])

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setState(INITIAL_STATE)
  }, [])

  return { state, render, reset }
}
