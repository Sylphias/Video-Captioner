import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { SubtitleComposition } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../store/subtitleStore.ts'
import { useWaveform } from '../hooks/useWaveform.ts'
import './PreviewPanel.css'

interface PreviewPanelProps {
  onSeekReady?: (seekFn: (timeSec: number) => void) => void
  onGetTimeReady?: (getTimeFn: () => number) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function PreviewPanel({ onSeekReady, onGetTimeReady, collapsed = false, onToggleCollapse }: PreviewPanelProps) {
  const jobId = useSubtitleStore((s) => s.jobId)
  const session = useSubtitleStore((s) => s.session)
  const videoMetadata = useSubtitleStore((s) => s.videoMetadata)
  const style = useSubtitleStore((s) => s.style)
  const speakerStyles = useSubtitleStore((s) => s.speakerStyles)

  const playerRef = useRef<PlayerRef>(null)
  const { waveform } = useWaveform(jobId)

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

  // Play state tracking
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const rafRef = useRef<number>(0)

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

  // Listen to player events for play/pause state
  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)

    player.addEventListener('play', onPlay)
    player.addEventListener('pause', onPause)
    player.addEventListener('ended', onEnded)

    return () => {
      player.removeEventListener('play', onPlay)
      player.removeEventListener('pause', onPause)
      player.removeEventListener('ended', onEnded)
    }
  }, [jobId])

  // Poll current frame via rAF
  useEffect(() => {
    const tick = () => {
      if (playerRef.current) {
        setCurrentFrame(playerRef.current.getCurrentFrame())
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const togglePlayPause = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (isPlaying) {
      player.pause()
    } else {
      player.play()
    }
  }, [isPlaying])

  // Spacebar to toggle play/pause (when not focused on an input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      e.preventDefault()
      togglePlayPause()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlayPause])

  // Memoize inputProps to prevent Player re-renders on unrelated state changes
  const inputProps = useMemo(() => {
    if (!jobId || !session) return null
    const videoSrc = `/api/jobs/${jobId}/video`
    return {
      videoSrc,
      phrases: session.phrases.map((p) => ({ words: p.words, dominantSpeaker: p.dominantSpeaker, lingerDuration: p.lingerDuration, styleOverride: p.styleOverride })),
      style,
      speakerStyles,
    }
  }, [jobId, session, style, speakerStyles])

  if (!jobId || !session || !videoMetadata || !inputProps) {
    return null
  }

  const durationInFrames = Math.max(1, Math.floor(videoMetadata.duration * videoMetadata.fps))

  // Collapsed state: show a thin bar with expand button
  if (collapsed) {
    return (
      <div className="preview-panel preview-panel--collapsed">
        <button
          className="preview-panel__expand-btn"
          type="button"
          onClick={onToggleCollapse}
        >
          ▾ Show preview
        </button>
      </div>
    )
  }

  const progressFraction = durationInFrames > 0 ? currentFrame / durationInFrames : 0

  return (
    <div ref={containerRef} className="preview-panel" style={{ maxWidth }}>
      {onToggleCollapse && (
        <button
          className="preview-panel__collapse-btn"
          type="button"
          onClick={onToggleCollapse}
          title="Hide preview"
        >
          ▴
        </button>
      )}
      {/* Click video to play/pause */}
      <div className="preview-panel__player-wrapper" onClick={togglePlayPause}>
        <Player
          ref={playerRef}
          component={SubtitleComposition}
          durationInFrames={durationInFrames}
          compositionWidth={videoMetadata.width}
          compositionHeight={videoMetadata.height}
          fps={videoMetadata.fps}
          loop
          style={{ width: '100%', cursor: 'pointer' }}
          inputProps={inputProps}
          acknowledgeRemotionLicense
        />
      </div>

      {/* Mini waveform scrubber */}
      {waveform && (
        <MiniWaveformScrubber
          samples={waveform.samples}
          duration={waveform.duration}
          progressFraction={progressFraction}
          onSeek={(timeSec) => seekToTime(timeSec)}
        />
      )}
    </div>
  )
}

// ── Mini Waveform Scrubber ──────────────────────────────────────────────────

interface MiniWaveformScrubberProps {
  samples: number[]
  duration: number
  progressFraction: number  // 0..1
  onSeek: (timeSec: number) => void
}

function MiniWaveformScrubber({ samples, duration, progressFraction, onSeek }: MiniWaveformScrubberProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  // Draw waveform with progress highlight
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || samples.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const centerY = h / 2
    const sampleCount = samples.length
    const sampleWidth = w / sampleCount
    const progressX = progressFraction * w

    for (let i = 0; i < sampleCount; i++) {
      const x = (i + 0.5) * sampleWidth
      const amplitude = samples[i]
      const halfHeight = amplitude * centerY * 0.9

      ctx.strokeStyle = x <= progressX
        ? 'rgba(0, 230, 150, 0.6)'   // played portion — brighter green
        : 'rgba(0, 230, 150, 0.2)'   // unplayed — dim
      ctx.lineWidth = Math.max(1, sampleWidth)

      ctx.beginPath()
      ctx.moveTo(x, centerY - halfHeight)
      ctx.lineTo(x, centerY + halfHeight)
      ctx.stroke()
    }

    // Draw playhead line
    ctx.strokeStyle = 'rgba(0, 230, 150, 1)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(progressX, 0)
    ctx.lineTo(progressX, h)
    ctx.stroke()
  }, [samples, progressFraction])

  const seekFromEvent = useCallback((clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onSeek(fraction * duration)
  }, [duration, onSeek])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true
    seekFromEvent(e.clientX)
  }, [seekFromEvent])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      seekFromEvent(e.clientX)
    }
    const onMouseUp = () => {
      isDraggingRef.current = false
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [seekFromEvent])

  // Resize canvas to container width
  const [canvasWidth, setCanvasWidth] = useState(300)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      setCanvasWidth(Math.floor(entry.contentRect.width))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const SCRUBBER_HEIGHT = 32

  return (
    <div
      ref={containerRef}
      className="preview-panel__mini-waveform"
      onMouseDown={handleMouseDown}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={SCRUBBER_HEIGHT}
        style={{ display: 'block', width: '100%', height: SCRUBBER_HEIGHT }}
      />
    </div>
  )
}
