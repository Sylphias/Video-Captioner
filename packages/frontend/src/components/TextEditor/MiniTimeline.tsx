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
}

export function MiniTimeline({ phrases, totalDuration, currentTime, activePhraseIndex, onSeek }: MiniTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current
    if (!track || totalDuration <= 0) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(ratio * totalDuration)
  }, [totalDuration, onSeek])

  if (totalDuration <= 0) return null

  const playheadPct = (currentTime / totalDuration) * 100

  return (
    <div className="mini-timeline">
      <div className="mini-timeline__track" ref={trackRef} onClick={handleClick}>
        {/* Phrase blocks */}
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
                width: `${Math.max(widthPct, 0.3)}%`,
                backgroundColor: color,
              }}
              title={`${phrase.words.map(w => w.word).join(' ').slice(0, 40)}...`}
            />
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
