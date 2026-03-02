import type { Transcript } from '@eigen/shared-types'
import './TranscriptView.css'

interface TranscriptViewProps {
  transcript: Transcript
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(1)
  return `${mins}:${secs.padStart(4, '0')}`
}

export function TranscriptView({ transcript }: TranscriptViewProps) {
  return (
    <div className="transcript-view">
      <div className="transcript-view__header">
        <span className="transcript-view__language">
          Language: {transcript.language}
        </span>
        <span className="transcript-view__word-count">
          {transcript.words.length} words
        </span>
      </div>
      <div className="transcript-view__words">
        {transcript.words.map((w, i) => (
          <span
            key={i}
            className="transcript-view__word"
            data-tooltip={`${formatTime(w.start)}–${formatTime(w.end)} (${Math.round(w.confidence * 100)}%)`}
          >
            {w.word}{' '}
          </span>
        ))}
      </div>
    </div>
  )
}
