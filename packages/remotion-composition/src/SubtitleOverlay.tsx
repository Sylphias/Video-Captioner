import { useCurrentFrame, useVideoConfig } from 'remotion'
import type { TranscriptWord } from '@eigen/shared-types'
import type { AnimationPreset } from '@eigen/shared-types'
import type { StyleProps, SpeakerStyleOverride, CompositionPhrase } from './types'
import { computeAnimationStyles, computeWordAnimationStyles, mergeStyles } from './animations'

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
  phrases: CompositionPhrase[]
  style: StyleProps
  speakerStyles: Record<string, SpeakerStyleOverride>
  animationPreset?: AnimationPreset  // global default animation preset for all phrases
}

export function SubtitleOverlay({ phrases, style, speakerStyles, animationPreset }: SubtitleOverlayProps) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

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

        // Determine the phrase's effective animation preset:
        // per-phrase resolved preset takes priority over global default
        const effectivePreset: AnimationPreset | undefined = activePhrase.animationPreset ?? animationPreset

        // Each phrase renders at its own vertical position; offset only on exact collision
        let top = effectiveStyle.verticalPosition
        if (phraseIdx > 0 && top === phraseStyles[0].verticalPosition) {
          top += OVERLAP_OFFSET_PCT
        }

        const phraseStart = activePhrase.words[0].start
        const phraseLingerSec = activePhrase.lingerDuration ?? style.lingerDuration ?? 1.0
        const phraseEnd = activePhrase.words[activePhrase.words.length - 1].end + phraseLingerSec

        const hasStroke = effectiveStyle.strokeWidth > 0

        // Compute phrase-scope animation styles (if applicable)
        const phraseAnimStyles: React.CSSProperties = (effectivePreset && effectivePreset.scope === 'phrase')
          ? computeAnimationStyles(phraseStart, phraseEnd, effectivePreset, frame, fps, width, height)
          : {}

        // Check for typewriter/letter-by-letter text slicing
        const textSliceProgress = ('--textSliceProgress' in phraseAnimStyles)
          ? (phraseAnimStyles as Record<string, unknown>)['--textSliceProgress'] as number
          : null
        // Remove the special marker from styles before spreading
        const cleanPhraseAnimStyles = textSliceProgress !== null
          ? (() => { const { ['--textSliceProgress' as keyof React.CSSProperties]: _, ...rest } = phraseAnimStyles as Record<string, unknown>; return rest as React.CSSProperties })()
          : phraseAnimStyles

        const containerStyle: React.CSSProperties = mergeStyles(
          {
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
          },
          cleanPhraseAnimStyles,
        )

        const wordCount = activePhrase.words.length

        return (
          <div
            key={`${activePhrase.words[0].start}-${phraseIdx}`}
            style={containerStyle}
          >
            {/* Stroke layer: text in stroke color with thick WebkitTextStroke, behind fill */}
            {hasStroke && (
              <div aria-hidden style={{ position: 'absolute', inset: 0, textAlign: 'center' }}>
                {activePhrase.words.map((word, i) => {
                  // Word-scope animation for stroke layer
                  const wordAnimStyles: React.CSSProperties = (effectivePreset && effectivePreset.scope === 'word')
                    ? computeWordAnimationStyles(i, wordCount, phraseStart, phraseEnd, effectivePreset, frame, fps, width, height)
                    : {}

                  // Typewriter slicing for stroke layer
                  const wordTextSliceProgress = ('--textSliceProgress' in wordAnimStyles)
                    ? (wordAnimStyles as Record<string, unknown>)['--textSliceProgress'] as number
                    : null
                  const cleanWordAnimStyles = wordTextSliceProgress !== null
                    ? (() => { const { ['--textSliceProgress' as keyof React.CSSProperties]: _, ...rest } = wordAnimStyles as Record<string, unknown>; return rest as React.CSSProperties })()
                    : wordAnimStyles

                  const displayText = wordTextSliceProgress !== null
                    ? word.word.slice(0, Math.floor(wordTextSliceProgress * word.word.length))
                    : (textSliceProgress !== null
                        ? word.word.slice(0, Math.floor(textSliceProgress * word.word.length))
                        : word.word)

                  return (
                    <span
                      key={`${word.start}-${i}`}
                      style={{
                        color: effectiveStyle.strokeColor,
                        marginRight: '0.25em',
                        WebkitTextStroke: `${effectiveStyle.strokeWidth * 2}px ${effectiveStyle.strokeColor}`,
                        ...cleanWordAnimStyles,
                      }}
                    >
                      {displayText}
                    </span>
                  )
                })}
              </div>
            )}

            {/* Fill layer: clean colored text on top */}
            {activePhrase.words.map((word, i) => {
              // Word-scope animation for fill layer
              const wordAnimStyles: React.CSSProperties = (effectivePreset && effectivePreset.scope === 'word')
                ? computeWordAnimationStyles(i, wordCount, phraseStart, phraseEnd, effectivePreset, frame, fps, width, height)
                : {}

              // Typewriter slicing for fill layer
              const wordTextSliceProgress = ('--textSliceProgress' in wordAnimStyles)
                ? (wordAnimStyles as Record<string, unknown>)['--textSliceProgress'] as number
                : null
              const cleanWordAnimStyles = wordTextSliceProgress !== null
                ? (() => { const { ['--textSliceProgress' as keyof React.CSSProperties]: _, ...rest } = wordAnimStyles as Record<string, unknown>; return rest as React.CSSProperties })()
                : wordAnimStyles

              const displayText = wordTextSliceProgress !== null
                ? word.word.slice(0, Math.floor(wordTextSliceProgress * word.word.length))
                : (textSliceProgress !== null
                    ? word.word.slice(0, Math.floor(textSliceProgress * word.word.length))
                    : word.word)

              return (
                <span
                  key={`${word.start}-${i}`}
                  style={{
                    position: 'relative',
                    color: i === activeWordIndex ? effectiveStyle.highlightColor : effectiveStyle.baseColor,
                    marginRight: '0.25em',
                    textShadow: `${effectiveStyle.shadowOffsetX ?? 0}px ${effectiveStyle.shadowOffsetY ?? 2}px ${effectiveStyle.shadowBlur ?? 4}px ${effectiveStyle.shadowColor ?? '#000000'}`,
                    ...cleanWordAnimStyles,
                  }}
                >
                  {displayText}
                </span>
              )
            })}
          </div>
        )
      })}
    </>
  )
}
