import { useState, useEffect } from 'react'

interface WaveformData {
  samples: number[]
  duration: number
}

// Module-level cache: keyed by jobId to avoid re-fetching on re-renders
const waveformCache = new Map<string, WaveformData>()
// Track failed attempts to avoid infinite retries
const failedAttempts = new Map<string, number>()
const MAX_RETRIES = 5
const RETRY_DELAY = 2000

/**
 * Fetch and cache audio waveform amplitude data for a given job.
 *
 * Returns { waveform, loading } where waveform is null until loaded.
 * Re-fetching is avoided by caching at the module level.
 * Retries on recoverable errors (409, 500) up to MAX_RETRIES times.
 */
export function useWaveform(jobId: string | null): { waveform: WaveformData | null; loading: boolean } {
  const [waveform, setWaveform] = useState<WaveformData | null>(() => {
    if (jobId && waveformCache.has(jobId)) {
      return waveformCache.get(jobId)!
    }
    return null
  })
  const [loading, setLoading] = useState<boolean>(() => {
    if (jobId && waveformCache.has(jobId)) return false
    return jobId !== null
  })
  const [retryCount, setRetryCount] = useState(0)

  // Reset retry count when jobId changes
  useEffect(() => {
    setRetryCount(0)
  }, [jobId])

  useEffect(() => {
    if (!jobId) return

    // Cache hit — no fetch needed
    if (waveformCache.has(jobId)) {
      setWaveform(waveformCache.get(jobId)!)
      setLoading(false)
      return
    }

    // Too many retries — give up
    if ((failedAttempts.get(jobId) ?? 0) >= MAX_RETRIES) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/jobs/${jobId}/waveform`)
      .then((res) => {
        if (!res.ok) throw new Error(`Waveform fetch failed: ${res.status}`)
        return res.json() as Promise<{ samples: number[]; duration: number }>
      })
      .then((data) => {
        if (cancelled) return
        const waveformData: WaveformData = { samples: data.samples, duration: data.duration }
        waveformCache.set(jobId, waveformData)
        failedAttempts.delete(jobId)
        setWaveform(waveformData)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('useWaveform: failed to load waveform', err)
        const attempts = (failedAttempts.get(jobId) ?? 0) + 1
        failedAttempts.set(jobId, attempts)
        if (attempts < MAX_RETRIES) {
          // Schedule a retry
          setTimeout(() => {
            if (!cancelled) setRetryCount(c => c + 1)
          }, RETRY_DELAY)
        } else {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [jobId, retryCount])

  return { waveform, loading }
}
