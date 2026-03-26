import { useState, useRef, useCallback } from 'react'
import type { Job } from '@eigen/shared-types'

export interface UploadState {
  status: 'idle' | 'uploading' | 'normalizing' | 'ready' | 'failed'
  progress: number
  jobId: string | null
  job: Job | null
  error: string | null
}

const INITIAL_STATE: UploadState = {
  status: 'idle',
  progress: 0,
  jobId: null,
  job: null,
  error: null,
}

export function useUpload() {
  const [state, setState] = useState<UploadState>(INITIAL_STATE)
  const eventSourceRef = useRef<EventSource | null>(null)

  const upload = useCallback((file: File) => {
    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setState({
      status: 'uploading',
      progress: 0,
      jobId: null,
      job: null,
      error: null,
    })

    const formData = new FormData()
    formData.append('file', file)

    // Use XMLHttpRequest for upload progress events
    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100)
        setState((prev) => ({ ...prev, progress: percent }))
      }
    }

    xhr.onload = () => {
      if (xhr.status === 202) {
        let parsed: { jobId: string }
        try {
          parsed = JSON.parse(xhr.responseText) as { jobId: string }
        } catch {
          setState((prev) => ({
            ...prev,
            status: 'failed',
            error: 'Invalid response from server',
          }))
          return
        }

        const { jobId } = parsed
        setState((prev) => ({ ...prev, jobId }))

        // Connect to SSE for job progress
        const es = new EventSource(`/api/jobs/${jobId}/status`)
        eventSourceRef.current = es

        es.onmessage = (event) => {
          let job: Job
          try {
            job = JSON.parse(event.data) as Job
          } catch {
            return
          }

          setState((prev) => ({
            ...prev,
            status: job.status as UploadState['status'],
            progress: job.progress,
            job,
          }))

          if (job.status === 'ready' || job.status === 'failed') {
            es.close()
            eventSourceRef.current = null
            if (job.status === 'failed') {
              setState((prev) => ({
                ...prev,
                error: job.error ?? 'Processing failed',
              }))
            }
          }
        }

        es.onerror = () => {
          es.close()
          eventSourceRef.current = null
          setState((prev) => {
            // Only mark as failed if not already in a terminal state
            if (prev.status === 'ready' || prev.status === 'failed') return prev
            return {
              ...prev,
              status: 'failed',
              error: 'Connection to server lost',
            }
          })
        }
      } else {
        setState((prev) => ({
          ...prev,
          status: 'failed',
          error: `Upload failed (HTTP ${xhr.status})`,
        }))
      }
    }

    xhr.onerror = () => {
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: 'Network error during upload',
      }))
    }

    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  }, [])

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setState(INITIAL_STATE)
  }, [])

  return { state, upload, reset }
}
