import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SessionPhrase } from '../../store/subtitleStore.ts'
import './MiniTimeline.css'

const SPEAKER_COLORS = ['#4A90D9', '#E67E22', '#27AE60', '#9B59B6', '#E74C3C', '#1ABC9C', '#F39C12', '#95A5A6']

function getSpeakerColor(speakerId: string): string {
  const idx = parseInt(speakerId.replace('SPEAKER_', ''), 10) % 8
  return SPEAKER_COLORS[isNaN(idx) ? 0 : idx]
}

interface SpeakerLane {
  speakerId: string
  phrases: Array<{ phrase: SessionPhrase; phraseIndex: number }>
}

interface WaveformData {
  samples: number[]
  duration: number
}

interface MiniTimelineProps {
  phrases: SessionPhrase[]
  totalDuration: number
  currentTime: number
  activePhraseIndex: number | null
  speakerNames: Record<string, string>
  waveform?: WaveformData | null
  onSeek: (timeSec: number) => void
  onAdjustStart?: (phraseIndex: number, newStartSec: number) => void
  onAdjustEnd?: (phraseIndex: number, newEndSec: number) => void
}

const MIN_VISIBLE_LANES = 3
const LANE_HEIGHT = 28
const WAVEFORM_HEIGHT = 48

export function MiniTimeline({
  phrases,
  totalDuration,
  currentTime,
  activePhraseIndex,
  speakerNames,
  waveform,
  onSeek,
  onAdjustStart,
  onAdjustEnd,
}: MiniTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef<{ type: 'start' | 'end'; phraseIndex: number } | null>(null)

  // Track container width for responsive canvas
  const [canvasWidth, setCanvasWidth] = useState(300)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setCanvasWidth(Math.floor(entry.contentRect.width))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Draw waveform
  useEffect(() => {
    const canvas = waveformCanvasRef.current
    if (!canvas || !waveform || waveform.samples.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const centerY = h / 2
    const sampleCount = waveform.samples.length
    const sampleWidth = w / sampleCount
    const playheadX = totalDuration > 0 ? (currentTime / totalDuration) * w : 0

    for (let i = 0; i < sampleCount; i++) {
      const x = (i + 0.5) * sampleWidth
      const amplitude = waveform.samples[i]
      const halfHeight = amplitude * centerY * 0.9

      ctx.strokeStyle = x <= playheadX
        ? 'rgba(0, 230, 150, 0.6)'
        : 'rgba(0, 230, 150, 0.2)'
      ctx.lineWidth = Math.max(1, sampleWidth)

      ctx.beginPath()
      ctx.moveTo(x, centerY - halfHeight)
      ctx.lineTo(x, centerY + halfHeight)
      ctx.stroke()
    }

    // Playhead line
    ctx.strokeStyle = 'rgba(0, 230, 150, 1)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, h)
    ctx.stroke()
  }, [waveform, currentTime, totalDuration, canvasWidth])

  const lanes = useMemo((): SpeakerLane[] => {
    const laneMap = new Map<string, SpeakerLane>()
    for (const speakerId of Object.keys(speakerNames)) {
      laneMap.set(speakerId, { speakerId, phrases: [] })
    }
    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[i]
      const speakerId = phrase.dominantSpeaker ?? '_unknown'
      if (!laneMap.has(speakerId)) {
        laneMap.set(speakerId, { speakerId, phrases: [] })
      }
      laneMap.get(speakerId)!.phrases.push({ phrase, phraseIndex: i })
    }
    return [...laneMap.values()].filter(l => l.phrases.length > 0)
  }, [phrases, speakerNames])

  const pxToTime = useCallback((clientX: number, targetEl?: HTMLElement): number => {
    // Use the target element's rect if provided, otherwise fall back to container
    const el = targetEl ?? containerRef.current
    if (!el || totalDuration <= 0) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * totalDuration
  }, [totalDuration])

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingRef.current) return
    if ((e.target as HTMLElement).closest('.mini-timeline__lane-label')) return
    const t = pxToTime(e.clientX, e.currentTarget)
    onSeek(t)
  }, [pxToTime, onSeek])

  const handleEdgeDrag = useCallback((
    e: React.MouseEvent,
    type: 'start' | 'end',
    phraseIndex: number,
  ) => {
    e.stopPropagation()
    e.preventDefault()
    draggingRef.current = { type, phraseIndex }

    const onMove = (moveE: MouseEvent) => {
      const t = pxToTime(moveE.clientX)
      if (type === 'start' && onAdjustStart) onAdjustStart(phraseIndex, t)
      else if (type === 'end' && onAdjustEnd) onAdjustEnd(phraseIndex, t)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      setTimeout(() => { draggingRef.current = null }, 10)
    }

    document.body.style.cursor = 'ew-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [pxToTime, onAdjustStart, onAdjustEnd])

  if (totalDuration <= 0) return null

  const playheadPct = (currentTime / totalDuration) * 100
  const needsScroll = lanes.length > MIN_VISIBLE_LANES
  const maxHeight = MIN_VISIBLE_LANES * LANE_HEIGHT

  // Pad with empty lanes if fewer than MIN_VISIBLE_LANES
  const emptyLaneCount = Math.max(0, MIN_VISIBLE_LANES - lanes.length)

  return (
    <div className="mini-timeline" ref={containerRef}>
      {/* Speaker lanes with waveform overlay */}
      <div
        className="mini-timeline__scroll"
        style={needsScroll ? { maxHeight, overflowY: 'auto' } : undefined}
        onClick={handleTrackClick}
      >
        {/* Waveform canvas — rendered behind lanes as absolute overlay */}
        {waveform && waveform.samples.length > 0 && (
          <canvas
            ref={waveformCanvasRef}
            className="mini-timeline__waveform-canvas"
            width={canvasWidth}
            height={lanes.length * LANE_HEIGHT + emptyLaneCount * LANE_HEIGHT}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        )}
        {/* Playhead overlay */}
        <div
          className="mini-timeline__playhead"
          style={{ left: `${playheadPct}%` }}
        />

        {/* Speaker lanes */}
        {lanes.map((lane) => {
          const color = getSpeakerColor(lane.speakerId)
          const label = speakerNames[lane.speakerId] ?? lane.speakerId

          return (
            <div key={lane.speakerId} className="mini-timeline__lane" style={{ height: LANE_HEIGHT }}>
              <span className="mini-timeline__lane-label" style={{ color }} title={label}>
                {label}
              </span>

              {lane.phrases.map(({ phrase, phraseIndex }) => {
                if (phrase.words.length === 0) return null
                const start = phrase.words[0].start
                const end = phrase.words[phrase.words.length - 1].end
                const leftPct = (start / totalDuration) * 100
                const widthPct = ((end - start) / totalDuration) * 100
                const isActive = phraseIndex === activePhraseIndex

                return (
                  <div
                    key={phraseIndex}
                    className={`mini-timeline__block${isActive ? ' mini-timeline__block--active' : ''}`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 0.3)}%`,
                      backgroundColor: color,
                    }}
                    title={phrase.words.map(w => w.word).join(' ').slice(0, 50)}
                  >
                    <div
                      className="mini-timeline__handle mini-timeline__handle--left"
                      onMouseDown={(e) => handleEdgeDrag(e, 'start', phraseIndex)}
                    />
                    <div
                      className="mini-timeline__handle mini-timeline__handle--right"
                      onMouseDown={(e) => handleEdgeDrag(e, 'end', phraseIndex)}
                    />
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Empty lane placeholders */}
        {Array.from({ length: emptyLaneCount }).map((_, i) => (
          <div key={`empty-${i}`} className="mini-timeline__lane mini-timeline__lane--empty" style={{ height: LANE_HEIGHT }} />
        ))}
      </div>
      <div className="mini-timeline__hints">
        <span>Ctrl+1 add phrase at playhead</span>
        <span>Ctrl+2 delete phrase at playhead</span>
      </div>
    </div>
  )
}
