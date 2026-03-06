import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { SubtitleComposition } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../store/subtitleStore.ts'
import './PreviewPanel.css'

interface PreviewPanelProps {
  onSeekReady?: (seekFn: (timeSec: number) => void) => void
  onGetTimeReady?: (getTimeFn: () => number) => void
}

export function PreviewPanel({ onSeekReady, onGetTimeReady }: PreviewPanelProps) {
  const jobId = useSubtitleStore((s) => s.jobId)
  const session = useSubtitleStore((s) => s.session)
  const videoMetadata = useSubtitleStore((s) => s.videoMetadata)
  const style = useSubtitleStore((s) => s.style)
  const speakerStyles = useSubtitleStore((s) => s.speakerStyles)

  const playerRef = useRef<PlayerRef>(null)

  // Derive max width from container height to maintain aspect ratio
  const containerRef = useRef<HTMLDivElement>(null)
  const [maxWidth, setMaxWidth] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (!videoMetadata || !containerRef.current) return
    const el = containerRef.current
    const observer = new ResizeObserver(([entry]) => {
      const aspect = videoMetadata.width / videoMetadata.height
      setMaxWidth(Math.floor(entry.contentRect.height * aspect))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [videoMetadata])

  const seekToTime = useCallback((timeSec: number) => {
    if (!playerRef.current || !videoMetadata) return
    playerRef.current.seekTo(Math.floor(timeSec * videoMetadata.fps))
  }, [videoMetadata])

  const getCurrentTimeSec = useCallback(() => {
    if (!playerRef.current || !videoMetadata) return 0
    return playerRef.current.getCurrentFrame() / videoMetadata.fps
  }, [videoMetadata])

  // Expose seekToTime and getCurrentTimeSec to parent once stable
  useEffect(() => {
    if (onSeekReady) onSeekReady(seekToTime)
  }, [onSeekReady, seekToTime])

  useEffect(() => {
    if (onGetTimeReady) onGetTimeReady(getCurrentTimeSec)
  }, [onGetTimeReady, getCurrentTimeSec])

  // Memoize inputProps to prevent Player re-renders on unrelated state changes
  const inputProps = useMemo(() => {
    if (!jobId || !session) return null
    const videoSrc = `/api/jobs/${jobId}/video`
    return {
      videoSrc,
      phrases: session.phrases.map((p) => ({ words: p.words, dominantSpeaker: p.dominantSpeaker })),
      style,
      speakerStyles,
    }
  }, [jobId, session, style, speakerStyles])

  if (!jobId || !session || !videoMetadata || !inputProps) {
    return null
  }

  const durationInFrames = Math.max(1, Math.floor(videoMetadata.duration * videoMetadata.fps))

  return (
    <div ref={containerRef} className="preview-panel" style={{ maxWidth }}>
      <Player
        ref={playerRef}
        component={SubtitleComposition}
        durationInFrames={durationInFrames}
        compositionWidth={videoMetadata.width}
        compositionHeight={videoMetadata.height}
        fps={videoMetadata.fps}
        controls
        loop
        style={{ width: '100%' }}
        inputProps={inputProps}
        acknowledgeRemotionLicense
      />
    </div>
  )
}
