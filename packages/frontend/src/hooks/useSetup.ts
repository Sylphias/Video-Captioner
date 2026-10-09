import { useState, useRef, useCallback, useEffect } from 'react'

export type SetupStatus = 'checking' | 'needed' | 'running' | 'ready' | 'error'

export interface SetupState {
  status: SetupStatus
  /** 0-100 while downloading; null when indeterminate (installing) */
  progress: number | null
  phaseLabel: string
  error: string | null
}

type SetupEvent =
  | { type: 'progress'; phase: 'preparing' | 'downloading' | 'installing'; percent?: number; message: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'cancelled' }

const INITIAL_STATE: SetupState = { status: 'checking', progress: 0, phaseLabel: '', error: null }

/**
 * Split an SSE text buffer into complete `data:` payloads. Returns the parsed events plus the
 * unconsumed remainder (a partial frame still waiting for its blank-line terminator).
 */
export function parseSseBuffer(buffer: string): { events: SetupEvent[]; rest: string } {
  const frames = buffer.split('\n\n')
  const rest = frames.pop() ?? ''
  const events: SetupEvent[] = []
  for (const frame of frames) {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('')
    if (!data) continue // comment / keep-alive frame
    try {
      events.push(JSON.parse(data) as SetupEvent)
    } catch {
      // ignore malformed frame
    }
  }
  return { events, rest }
}

export function useSetup() {
  const [state, setState] = useState<SetupState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)

  const applyEvent = useCallback((event: SetupEvent) => {
    switch (event.type) {
      case 'progress':
        setState({
          status: 'running',
          progress: event.phase === 'installing' ? null : (event.percent ?? 0),
          phaseLabel: event.message,
          error: null,
        })
        break
      case 'done':
        setState({ status: 'ready', progress: 100, phaseLabel: '', error: null })
        break
      case 'error':
        setState({ status: 'error', progress: 0, phaseLabel: '', error: event.message })
        break
      case 'cancelled':
        setState({ status: 'needed', progress: 0, phaseLabel: '', error: null })
        break
    }
  }, [])

  /** POST /api/setup/start and consume its SSE stream (also re-attaches to a run in flight). */
  const startSetup = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ status: 'running', progress: 0, phaseLabel: 'Preparing environment…', error: null })

    try {
      const res = await fetch('/api/setup/start', { method: 'POST', signal: controller.signal })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let terminal = false
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parsed = parseSseBuffer(buffer)
        buffer = parsed.rest
        for (const event of parsed.events) {
          applyEvent(event)
          if (event.type !== 'progress') terminal = true
        }
      }
      if (!terminal && !controller.signal.aborted) {
        setState({ status: 'error', progress: 0, phaseLabel: '', error: 'Connection to the backend was lost', })
      }
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : String(err)
      setState({ status: 'error', progress: 0, phaseLabel: '', error: message })
    }
  }, [applyEvent])

  /** Cancel a running setup: tells the backend to kill uv and discard the partial environment. */
  const cancelSetup = useCallback(async () => {
    try {
      // The open stream then delivers a terminal 'cancelled' event once cleanup finishes
      await fetch('/api/setup/cancel', { method: 'POST' })
    } catch {
      // Backend unreachable: dropping the stream also stops the run server-side (grace period)
      abortRef.current?.abort()
      setState({ status: 'needed', progress: 0, phaseLabel: '', error: null })
    }
  }, [])

  // Initial detection: venv present -> ready; setup already running -> re-attach; else needed
  useEffect(() => {
    let disposed = false
    void (async () => {
      try {
        const res = await fetch('/api/setup/status')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { ready: boolean; running?: boolean }
        if (disposed) return
        if (data.ready) setState({ status: 'ready', progress: 100, phaseLabel: '', error: null })
        else if (data.running) void startSetup()
        else setState({ status: 'needed', progress: 0, phaseLabel: '', error: null })
      } catch {
        // Status endpoint unreachable: do not block the editor behind a setup screen we cannot drive
        if (!disposed) setState({ status: 'ready', progress: 100, phaseLabel: '', error: null })
      }
    })()
    return () => {
      disposed = true
      abortRef.current?.abort()
    }
  }, [startSetup])

  return { ...state, startSetup, cancelSetup }
}
