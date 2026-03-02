import { useState, useEffect, useRef, useCallback } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { SubtitleComposition } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../store/subtitleStore.ts'
import './PreviewPanel.css'

interface PreviewPanelProps {
  onSeekReady?: (seekFn: (timeSec: number) => void) => void
}

export function PreviewPanel({ onSeekReady }: PreviewPanelProps) {
  const jobId = useSubtitleStore((s) => s.jobId)
  const session = useSubtitleStore((s) => s.session)
  const videoMetadata = useSubtitleStore((s) => s.videoMetadata)
  const style = useSubtitleStore((s) => s.style)

  const playerRef = useRef<PlayerRef>(null)

  // Fit player to 65% of viewport height, derive width from aspect ratio
  const [maxWidth, setMaxWidth] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (!videoMetadata) return
    const update = () => {
      const targetHeight = window.innerHeight * 0.65
      const aspect = videoMetadata.width / videoMetadata.height
      setMaxWidth(Math.floor(targetHeight * aspect))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [videoMetadata])

  const seekToTime = useCallback((timeSec: number) => {
    if (!playerRef.current || !videoMetadata) return
    playerRef.current.seekTo(Math.floor(timeSec * videoMetadata.fps))
  }, [videoMetadata])

  // Expose seekToTime to parent once it's stable
  useEffect(() => {
    if (onSeekReady) onSeekReady(seekToTime)
  }, [onSeekReady, seekToTime])

  if (!jobId || !session || !videoMetadata) {
    return null
  }

  const durationInFrames = Math.max(1, Math.floor(videoMetadata.duration * videoMetadata.fps))
  const videoSrc = `/api/jobs/${jobId}/video`

  return (
    <div className="preview-panel" style={{ maxWidth }}>
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
        inputProps={{
          videoSrc,
          phrases: session.phrases.map((p) => ({ words: p.words })),
          style,
        }}
        acknowledgeRemotionLicense
      />
    </div>
  )
}
