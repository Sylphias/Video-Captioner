import { useCurrentFrame, useVideoConfig } from 'remotion'
import type { TranscriptWord, TranscriptPhrase } from '@eigen/shared-types'
import type { StyleProps } from './types'

/**
 * Binary search: find the index of the last word whose start <= currentTimeSec.
 * Karaoke UX: the most recently started word stays highlighted even during
 * intra-phrase gaps (brief silences between words). This prevents flickering.
 */
export function findActiveWordIndex(words: TranscriptWord[], currentTimeSec: number): number {
  if (words.length === 0) return -1

  let lo = 0
  let hi = words.length - 1
  let result = -1

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (words[mid].start <= currentTimeSec) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return result
}

interface SubtitleOverlayProps {
  phrases: TranscriptPhrase[]
  style: StyleProps
}

export function SubtitleOverlay({ phrases, style }: SubtitleOverlayProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentTimeSec = frame / fps

  // Find the active phrase: one where current time falls within the phrase window.
  // Keep phrase visible for 0.5s after last word ends for readability.
  const LINGER_SEC = 0.5
  const activePhrase = phrases.find((phrase) => {
    const phraseStart = phrase.words[0].start
    const phraseEnd = phrase.words[phrase.words.length - 1].end + LINGER_SEC
    return currentTimeSec >= phraseStart && currentTimeSec <= phraseEnd
  }) ?? null

  if (activePhrase === null) {
    return null
  }

  const activeWordIndex = findActiveWordIndex(activePhrase.words, currentTimeSec)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '10%',
        left: '5%',
        right: '5%',
        textAlign: 'center',
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        lineHeight: 1.4,
      }}
    >
      {activePhrase.words.map((word, i) => (
        <span
          key={`${word.start}-${i}`}
          style={{
            color: i === activeWordIndex ? style.highlightColor : style.baseColor,
            marginRight: '0.25em',
            textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)',
          }}
        >
          {word.word}
        </span>
      ))}
    </div>
  )
}
