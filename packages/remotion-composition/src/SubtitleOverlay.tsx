import { useCurrentFrame, useVideoConfig } from 'remotion'
import type { TranscriptWord, TranscriptPhrase } from '@eigen/shared-types'
import type { StyleProps, SpeakerStyleOverride } from './types'

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

/** Vertical offset (in percentage points) between simultaneous phrases */
const OVERLAP_OFFSET_PCT = 8

interface SubtitleOverlayProps {
  phrases: TranscriptPhrase[]
  style: StyleProps
  speakerStyles: Record<string, SpeakerStyleOverride>
}

export function SubtitleOverlay({ phrases, style, speakerStyles }: SubtitleOverlayProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentTimeSec = frame / fps

  // Find ALL active phrases — supports overlapping speakers
  // Per-phrase lingerDuration overrides global style.lingerDuration when set
  const activePhrases = phrases.filter((phrase) => {
    const phraseLingerSec = phrase.lingerDuration ?? style.lingerDuration ?? 1.0
    const phraseStart = phrase.words[0].start
    const phraseEnd = phrase.words[phrase.words.length - 1].end + phraseLingerSec
    return currentTimeSec >= phraseStart && currentTimeSec <= phraseEnd
  })

  if (activePhrases.length === 0) {
    return null
  }

  // Render up to 2 simultaneous phrases (primary + secondary)
  const visiblePhrases = activePhrases.slice(0, 2)

  return (
    <>
      {visiblePhrases.map((activePhrase, phraseIdx) => {
        const activeWordIndex = findActiveWordIndex(activePhrase.words, currentTimeSec)

        // Merge per-speaker style override with global style
        const dominantSpeaker = activePhrase.dominantSpeaker
        const override: SpeakerStyleOverride = dominantSpeaker ? (speakerStyles[dominantSpeaker] ?? {}) : {}
        const effectiveStyle: StyleProps = { ...style, ...override }

        // Secondary phrase renders below the primary
        const positionOffset = phraseIdx * OVERLAP_OFFSET_PCT

        return (
          <div
            key={`${activePhrase.words[0].start}-${phraseIdx}`}
            style={{
              position: 'absolute',
              top: `${effectiveStyle.verticalPosition + positionOffset}%`,
              transform: 'translateY(-50%)',
              left: '5%',
              right: '5%',
              textAlign: 'center',
              fontSize: effectiveStyle.fontSize,
              fontFamily: effectiveStyle.fontFamily,
              lineHeight: 1.4,
              WebkitTextStroke: effectiveStyle.strokeWidth > 0
                ? `${effectiveStyle.strokeWidth}px ${effectiveStyle.strokeColor}`
                : undefined,
            }}
          >
            {activePhrase.words.map((word, i) => (
              <span
                key={`${word.start}-${i}`}
                style={{
                  color: i === activeWordIndex ? effectiveStyle.highlightColor : effectiveStyle.baseColor,
                  marginRight: '0.25em',
                  textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)',
                }}
              >
                {word.word}
              </span>
            ))}
          </div>
        )
      })}
    </>
  )
}
