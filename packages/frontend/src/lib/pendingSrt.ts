import type { SrtCue } from './srtAlignment.ts'

/**
 * Single-slot handoff for "use SRT instead of transcribing" between
 * ProjectsPage (which knows the chosen SRT and the jobId once upload
 * completes) and SubtitlesPage (whose auto-transcribe effect consumes it
 * after navigation). Keyed by jobId so a stale slot from an aborted upload
 * can never attach to an unrelated project.
 */
let slot: { jobId: string; cues: SrtCue[] } | null = null

export function setPendingSrt(jobId: string, cues: SrtCue[]): void {
  slot = { jobId, cues }
}

export function consumePendingSrt(jobId: string): SrtCue[] | null {
  if (!slot || slot.jobId !== jobId) return null
  const { cues } = slot
  slot = null
  return cues
}
