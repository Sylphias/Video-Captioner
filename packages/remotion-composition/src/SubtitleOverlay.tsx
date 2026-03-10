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

  // Pre-compute effective styles to detect position collisions
  const phraseStyles = visiblePhrases.map((activePhrase) => {
    const dominantSpeaker = activePhrase.dominantSpeaker
    const override: SpeakerStyleOverride = dominantSpeaker ? (speakerStyles[dominantSpeaker] ?? {}) : {}
    const phraseOverride = (activePhrase.styleOverride ?? {}) as SpeakerStyleOverride
    return { ...style, ...override, ...phraseOverride } as StyleProps
  })

  return (
    <>
      {visiblePhrases.map((activePhrase, phraseIdx) => {
        const activeWordIndex = findActiveWordIndex(activePhrase.words, currentTimeSec)

        const effectiveStyle = phraseStyles[phraseIdx]

        // Each phrase renders at its own vertical position; offset only on exact collision
        let top = effectiveStyle.verticalPosition
        if (phraseIdx > 0 && top === phraseStyles[0].verticalPosition) {
          top += OVERLAP_OFFSET_PCT
        }

        const hasStroke = effectiveStyle.strokeWidth > 0

        const containerStyle: React.CSSProperties = {
          position: 'absolute',
          top: `${top}%`,
          transform: 'translateY(-50%)',
          left: '5%',
          right: '5%',
          textAlign: 'center',
          fontSize: effectiveStyle.fontSize,
          fontFamily: effectiveStyle.fontFamily,
          fontWeight: effectiveStyle.fontWeight,
          lineHeight: 1.4,
        }

        return (
          <div
            key={`${activePhrase.words[0].start}-${phraseIdx}`}
            style={containerStyle}
          >
            {/* Stroke layer: text in stroke color with thick WebkitTextStroke, behind fill */}
            {hasStroke && (
              <div aria-hidden style={{ position: 'absolute', inset: 0, textAlign: 'center' }}>
                {activePhrase.words.map((word, i) => (
                  <span
                    key={`${word.start}-${i}`}
                    style={{
                      color: effectiveStyle.strokeColor,
                      marginRight: '0.25em',
                      WebkitTextStroke: `${effectiveStyle.strokeWidth * 2}px ${effectiveStyle.strokeColor}`,
                    }}
                  >
                    {word.word}
                  </span>
                ))}
              </div>
            )}

            {/* Fill layer: clean colored text on top */}
            {activePhrase.words.map((word, i) => (
              <span
                key={`${word.start}-${i}`}
                style={{
                  position: 'relative',
                  color: i === activeWordIndex ? effectiveStyle.highlightColor : effectiveStyle.baseColor,
                  marginRight: '0.25em',
                  textShadow: `${effectiveStyle.shadowOffsetX ?? 0}px ${effectiveStyle.shadowOffsetY ?? 2}px ${effectiveStyle.shadowBlur ?? 4}px ${effectiveStyle.shadowColor ?? '#000000'}`,
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
