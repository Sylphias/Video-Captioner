import React, { useCallback, useRef } from 'react'
import type { SessionPhrase } from '../../store/subtitleStore.ts'
import './MiniTimeline.css'

const SPEAKER_COLORS = ['#4A90D9', '#E67E22', '#27AE60', '#9B59B6', '#E74C3C', '#1ABC9C', '#F39C12', '#95A5A6']

function getSpeakerColor(speakerId: string): string {
  const idx = parseInt(speakerId.replace('SPEAKER_', ''), 10) % 8
  return SPEAKER_COLORS[isNaN(idx) ? 0 : idx]
}

interface MiniTimelineProps {
  phrases: SessionPhrase[]
  totalDuration: number
  currentTime: number
  activePhraseIndex: number | null
  onSeek: (timeSec: number) => void
  /** Called when user drags the start edge of a phrase's first word */
  onAdjustStart?: (phraseIndex: number, newStartSec: number) => void
  /** Called when user drags the end edge of a phrase's last word */
  onAdjustEnd?: (phraseIndex: number, newEndSec: number) => void
}

export function MiniTimeline({
  phrases,
  totalDuration,
  currentTime,
  activePhraseIndex,
  onSeek,
  onAdjustStart,
  onAdjustEnd,
}: MiniTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<{ type: 'start' | 'end'; phraseIndex: number } | null>(null)

  const pxToTime = useCallback((clientX: number): number => {
    const track = trackRef.current
    if (!track || totalDuration <= 0) return 0
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * totalDuration
  }, [totalDuration])

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't seek if we just finished a drag
    if (draggingRef.current) return
    const t = pxToTime(e.clientX)
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
      if (type === 'start' && onAdjustStart) {
        onAdjustStart(phraseIndex, t)
      } else if (type === 'end' && onAdjustEnd) {
        onAdjustEnd(phraseIndex, t)
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      // Clear drag state after a tick so click handler doesn't fire
      setTimeout(() => { draggingRef.current = null }, 10)
    }

    document.body.style.cursor = 'ew-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [pxToTime, onAdjustStart, onAdjustEnd])

  if (totalDuration <= 0) return null

  const playheadPct = (currentTime / totalDuration) * 100

  return (
    <div className="mini-timeline">
      <div className="mini-timeline__track" ref={trackRef} onClick={handleTrackClick}>
        {/* Phrase blocks with drag handles */}
        {phrases.map((phrase, i) => {
          if (phrase.words.length === 0) return null
          const start = phrase.words[0].start
          const end = phrase.words[phrase.words.length - 1].end
          const leftPct = (start / totalDuration) * 100
          const widthPct = ((end - start) / totalDuration) * 100
          const color = phrase.dominantSpeaker
            ? getSpeakerColor(phrase.dominantSpeaker)
            : '#888'
          const isActive = i === activePhraseIndex

          return (
            <div
              key={i}
              className={`mini-timeline__block${isActive ? ' mini-timeline__block--active' : ''}`}
              style={{
                left: `${leftPct}%`,
                width: `${Math.max(widthPct, 0.5)}%`,
                backgroundColor: color,
              }}
              title={`${phrase.words.map(w => w.word).join(' ').slice(0, 50)}`}
            >
              {/* Left drag handle — adjust phrase start */}
              <div
                className="mini-timeline__handle mini-timeline__handle--left"
                onMouseDown={(e) => handleEdgeDrag(e, 'start', i)}
              />
              {/* Right drag handle — adjust phrase end */}
              <div
                className="mini-timeline__handle mini-timeline__handle--right"
                onMouseDown={(e) => handleEdgeDrag(e, 'end', i)}
              />
            </div>
          )
        })}

        {/* Playhead */}
        <div
          className="mini-timeline__playhead"
          style={{ left: `${playheadPct}%` }}
        />
      </div>
    </div>
  )
}
