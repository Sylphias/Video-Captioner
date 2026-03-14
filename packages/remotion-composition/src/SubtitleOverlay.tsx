import { useMemo } from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import type { TranscriptWord } from '@eigen/shared-types'
import type { AnimationPreset } from '@eigen/shared-types'
import type { StyleProps, SpeakerStyleOverride, CompositionPhrase } from './types'
import { computeAnimationStyles, computeWordAnimationStyles, computeKeyframeStyles, mergeStyles } from './animations'

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

/**
 * Pre-compute a stable slot for every phrase so overlapping subtitles
 * don't jump when the set of visible phrases changes.
 * Slot 0 = base position, slot 1 = one step up, etc.
 */
function assignSlots(phrases: CompositionPhrase[], defaultLinger: number): Map<CompositionPhrase, number> {
  const sorted = [...phrases].sort((a, b) => a.words[0].start - b.words[0].start)
  const slotMap = new Map<CompositionPhrase, number>()
  const assigned: { phrase: CompositionPhrase; end: number; slot: number }[] = []
  // Track last slot per speaker so consecutive same-speaker phrases inherit it
  const lastSpeakerSlot = new Map<string, { slot: number; end: number }>()

  for (const phrase of sorted) {
    const phraseStart = phrase.words[0].start
    const speaker = phrase.dominantSpeaker ?? '__default__'
    const lingerSec = phrase.lingerDuration ?? defaultLinger
    const phraseEnd = phrase.words[phrase.words.length - 1].end + lingerSec

    // If the previous phrase from this speaker is still lingering when this
    // one starts, inherit its slot so the speaker stays in the same row.
    const prev = lastSpeakerSlot.get(speaker)
    if (prev && prev.end > phraseStart) {
      slotMap.set(phrase, prev.slot)
      lastSpeakerSlot.set(speaker, { slot: prev.slot, end: phraseEnd })
      assigned.push({ phrase, end: phraseEnd, slot: prev.slot })
      continue
    }

    // Collect slots occupied by other speakers at this phrase's start time
    const occupied = new Set<number>()
    for (const a of assigned) {
      const aSpeaker = a.phrase.dominantSpeaker ?? '__default__'
      if (aSpeaker === speaker) continue
      if (a.end > phraseStart) {
        occupied.add(a.slot)
      }
    }
    // Find lowest available slot
    let slot = 0
    while (occupied.has(slot)) slot++
    slotMap.set(phrase, slot)
    lastSpeakerSlot.set(speaker, { slot, end: phraseEnd })
    assigned.push({ phrase, end: phraseEnd, slot })
  }

  return slotMap
}

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

  const slotMap = useMemo(
    () => assignSlots(phrases, style.lingerDuration ?? 1.0),
    [phrases, style.lingerDuration]
  )

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

  // Same-speaker phrases replace each other — only keep the latest per speaker.
  // Phrases without a dominantSpeaker share a common "__default__" bucket so
  // consecutive no-speaker phrases also replace rather than stack.
  const latestBySpeaker = new Map<string, CompositionPhrase>()
  for (const phrase of activePhrases) {
    const speaker = phrase.dominantSpeaker ?? '__default__'
    const existing = latestBySpeaker.get(speaker)
    if (!existing || phrase.words[0].start > existing.words[0].start) {
      latestBySpeaker.set(speaker, phrase)
    }
  }
  const visiblePhrases = activePhrases.filter((phrase) => {
    const speaker = phrase.dominantSpeaker ?? '__default__'
    return latestBySpeaker.get(speaker) === phrase
  })

  // Pre-compute effective styles for all visible phrases
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

        // Stable slot-based positioning: each phrase keeps its row for its lifetime
        const slot = slotMap.get(activePhrase) ?? 0
        const top = effectiveStyle.verticalPosition - slot * OVERLAP_OFFSET_PCT

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

        // Compute keyframe-driven position/scale/rotation/opacity at phrase level.
        // For phrase-scope: computeAnimationStyles already includes keyframe styles
        // internally, so only add keyframeAnimStyles for word-scope presets (where
        // cleanPhraseAnimStyles is {}) to avoid doubling transforms.
        const phraseProgress = (() => {
          const totalPhraseFrames = Math.round((phraseEnd - phraseStart) * fps)
          const frameIntoPhrase = frame - Math.round(phraseStart * fps)
          return totalPhraseFrames > 0 ? Math.max(0, Math.min(1, frameIntoPhrase / totalPhraseFrames)) : 0
        })()

        const hasPositionKeyframes = effectivePreset?.keyframeTracks?.some(
          (t) => t.property === 'x' || t.property === 'y'
        ) ?? false

        // Only compute and merge keyframe styles at container level for word-scope
        // (phrase-scope already has them merged inside cleanPhraseAnimStyles).
        const containerKeyframeStyles: React.CSSProperties =
          (effectivePreset?.scope === 'word' && effectivePreset.keyframeTracks && effectivePreset.keyframeTracks.length > 0)
            ? computeKeyframeStyles(effectivePreset.keyframeTracks, phraseProgress, width, height)
            : {}

        const baseStyle: React.CSSProperties = hasPositionKeyframes
          ? {
              // When keyframes control position, use absolute center as origin
              // so keyframe translateX/Y moves text to the authored position
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              fontSize: effectiveStyle.fontSize,
              fontFamily: effectiveStyle.fontFamily,
              fontWeight: effectiveStyle.fontWeight,
              lineHeight: 1.4,
            }
          : {
              // Default slot-based positioning
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

        const containerStyle: React.CSSProperties = mergeStyles(
          baseStyle,
          cleanPhraseAnimStyles,
          containerKeyframeStyles,
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
