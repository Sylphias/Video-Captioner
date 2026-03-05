import { useState, useRef, useCallback, useEffect } from 'react'
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

    // Read current phrases and style from Zustand store
    const { session, style } = useSubtitleStore.getState()
    const phrases = (session?.phrases ?? []).map((p) => ({ words: p.words }))

    // POST to trigger the render
    try {
      const res = await fetch(`/api/jobs/${jobId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrases, style }),
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
