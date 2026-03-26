import { useState, useEffect } from 'react'

interface WaveformData {
  samples: number[]
  duration: number
}

// Module-level cache: keyed by jobId to avoid re-fetching on re-renders
const waveformCache = new Map<string, WaveformData>()

/**
 * Fetch and cache audio waveform amplitude data for a given job.
 *
 * Returns { waveform, loading } where waveform is null until loaded.
 * Re-fetching is avoided by caching at the module level.
 */
export function useWaveform(jobId: string | null): { waveform: WaveformData | null; loading: boolean } {
  const [waveform, setWaveform] = useState<WaveformData | null>(() => {
    // Initialize from cache on first render
    if (jobId && waveformCache.has(jobId)) {
      return waveformCache.get(jobId)!
    }
    return null
  })
  const [loading, setLoading] = useState<boolean>(() => {
    // Already cached — no loading needed
    if (jobId && waveformCache.has(jobId)) return false
    return jobId !== null
  })

  useEffect(() => {
    if (!jobId) return

    // Cache hit — no fetch needed
    if (waveformCache.has(jobId)) {
      setWaveform(waveformCache.get(jobId)!)
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
        setWaveform(waveformData)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('useWaveform: failed to load waveform', err)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [jobId])

  return { waveform, loading }
}
