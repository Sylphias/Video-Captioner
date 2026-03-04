import { useState, useRef, useCallback } from 'react'
import type { Job, Transcript } from '@eigen/shared-types'
import { useSubtitleStore } from '../store/subtitleStore.ts'

export interface DiarizeState {
  status: 'idle' | 'diarizing' | 'done' | 'failed'
  progress: number
  error?: string
}

const INITIAL_STATE: DiarizeState = {
  status: 'idle',
  progress: 0,
}

export function useDiarize() {
  const [state, setState] = useState<DiarizeState>(INITIAL_STATE)
  const eventSourceRef = useRef<EventSource | null>(null)

  const diarize = useCallback(async (jobId: string, numSpeakers?: number) => {
    // Close any existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setState({ status: 'diarizing', progress: 0 })

    // Trigger diarization via POST
    try {
      const body: Record<string, number> = {}
      if (numSpeakers !== undefined) body.numSpeakers = numSpeakers

      const res = await fetch(`/api/jobs/${jobId}/diarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        setState({ status: 'failed', progress: 0, error: data.error ?? `HTTP ${res.status}` })
        return
      }
    } catch {
      setState({ status: 'failed', progress: 0, error: 'Network error' })
      return
    }

    // Connect to SSE for progress updates
    const es = new EventSource(`/api/jobs/${jobId}/status`)
    eventSourceRef.current = es

    es.onmessage = async (event) => {
      let job: Job
      try {
        job = JSON.parse(event.data) as Job
      } catch { return }

      if (job.status === 'diarizing') {
        setState(prev => ({ ...prev, progress: job.progress ?? 0 }))
      } else if (job.status === 'transcribed') {
        // Diarization complete — fetch the speaker-enriched transcript
        es.close()
        eventSourceRef.current = null

        try {
          const res = await fetch(`/api/jobs/${jobId}/transcript`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const transcript = await res.json() as Transcript
          const videoMetadata = useSubtitleStore.getState().videoMetadata
          if (videoMetadata) {
            useSubtitleStore.getState().setJob(jobId, transcript, videoMetadata)
          }
          setState({ status: 'done', progress: 100 })
        } catch {
          setState({ status: 'failed', progress: 0, error: 'Failed to load speaker-enriched transcript' })
        }
      } else if (job.status === 'failed') {
        es.close()
        eventSourceRef.current = null
        setState({ status: 'failed', progress: 0, error: job.error ?? 'Diarization failed' })
      }
      // Ignore other statuses (ready, uploading, normalizing, transcribing)
    }

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setState(prev => {
        if (prev.status === 'done' || prev.status === 'failed') return prev
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

  return { state, diarize, reset }
}
