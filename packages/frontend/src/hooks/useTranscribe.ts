import { useState, useRef, useCallback } from 'react'
import type { Job, Transcript } from '@eigen/shared-types'

export interface TranscribeState {
  status: 'idle' | 'transcribing' | 'transcribed' | 'failed'
  progress: number
  transcript: Transcript | null
  error: string | null
}

const INITIAL_STATE: TranscribeState = {
  status: 'idle',
  progress: 0,
  transcript: null,
  error: null,
}

export function useTranscribe() {
  const [state, setState] = useState<TranscribeState>(INITIAL_STATE)
  const eventSourceRef = useRef<EventSource | null>(null)

  const fetchTranscript = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/transcript`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const transcript = await res.json() as Transcript
      setState({ status: 'transcribed', progress: 100, transcript, error: null })
    } catch {
      setState(prev => ({ ...prev, status: 'failed', error: 'Failed to load transcript' }))
    }
  }, [])

  const transcribe = useCallback(async (jobId: string) => {
    // Close any existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setState({ status: 'transcribing', progress: 0, transcript: null, error: null })

    // Trigger transcription via POST
    try {
      const res = await fetch(`/api/jobs/${jobId}/transcribe`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }))
        setState(prev => ({ ...prev, status: 'failed', error: body.error || `HTTP ${res.status}` }))
        return
      }
    } catch {
      setState(prev => ({ ...prev, status: 'failed', error: 'Network error' }))
      return
    }

    // Connect to SSE for progress updates
    const es = new EventSource(`/api/jobs/${jobId}/status`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      let job: Job
      try {
        job = JSON.parse(event.data) as Job
      } catch { return }

      if (job.status === 'transcribing') {
        setState(prev => ({ ...prev, progress: job.progress }))
      } else if (job.status === 'transcribed') {
        es.close()
        eventSourceRef.current = null
        // Fetch the completed transcript
        fetchTranscript(jobId)
      } else if (job.status === 'failed') {
        es.close()
        eventSourceRef.current = null
        setState(prev => ({ ...prev, status: 'failed', error: job.error ?? 'Transcription failed' }))
      }
      // Ignore other statuses (ready, uploading, normalizing) — SSE stream may carry them briefly
    }

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setState(prev => {
        if (prev.status === 'transcribed' || prev.status === 'failed') return prev
        return { ...prev, status: 'failed', error: 'Connection to server lost' }
      })
    }
  }, [fetchTranscript])

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setState(INITIAL_STATE)
  }, [])

  return { state, transcribe, reset }
}
