import React from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import type { TranscriptWord, HighlightKeyframeConfig, KeyframeTrack } from '@eigen/shared-types'
import type { AnimationPreset } from '@eigen/shared-types'
import { isLegacyKeyframeTracks } from '@eigen/shared-types'
import type { StyleProps, SpeakerStyleOverride, CompositionPhrase } from './types'
import { computeAnimationStyles, computeWordAnimationStyles, computeKeyframeStyles, mergeStyles } from './animations'

const SPEAKER_COLORS = ['#4A90D9', '#E67E22', '#27AE60', '#9B59B6', '#E74C3C', '#1ABC9C', '#F39C12', '#95A5A6']
function getSpeakerColor(speakerId: string): string {
  const idx = parseInt(speakerId.replace('SPEAKER_', ''), 10) % 8
  return SPEAKER_COLORS[isNaN(idx) ? 0 : idx]
}

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

/**
 * Compute the vertical position (0-100%) for a phrase based on:
 *   1. Per-phrase styleOverride.verticalPosition (highest priority)
 *   2. Speaker lane position from speakerLanes
 *   3. Global style.verticalPosition (fallback)
 *
 * sameSlotOffset: 0 for the latest phrase of this speaker, 1+ for lingering
 * older phrases from the same speaker that are still visible.
 */
function getLanePosition(
  phrase: CompositionPhrase,
  speakerLanes: Record<string, { verticalPosition: number }>,
  defaultPosition: number,
  overlapGap: number,
  sameSlotOffset: number,
): number {
  // Per-phrase override takes highest precedence
  if ((phrase.styleOverride as Record<string, unknown> | undefined)?.verticalPosition != null) {
    const phrasePos = ((phrase.styleOverride as Record<string, unknown>).verticalPosition as number)
    return phrasePos - sameSlotOffset * overlapGap
  }
  // Speaker lane position
  const speaker = phrase.dominantSpeaker
  const lane = speaker ? speakerLanes[speaker] : undefined
  const basePosition = lane?.verticalPosition ?? defaultPosition
  return basePosition - sameSlotOffset * overlapGap
}

// ─── Highlight animation per word (keyframe-based) ───────────────────────────

/**
 * Compute the percentage (0-100) within the highlight enter animation for a word.
 * Exit auto-reverses: percentage goes 100→0.
 * Returns -1 if the word has no highlight animation active.
 */
function computeHighlightPct(
  wordIndex: number,
  activeWordIndex: number,
  words: TranscriptWord[],
  currentTimeSec: number,
  config: HighlightKeyframeConfig,
): number {
  // Compute this word's active duration (time until next word starts or word ends)
  const wordStart = words[wordIndex].start
  const wordEnd = words[wordIndex + 1]?.start ?? words[wordIndex].end
  const wordDuration = wordEnd - wordStart
  const enterDurationSec = (config.enterPct / 100) * wordDuration
  if (enterDurationSec <= 0) return wordIndex === activeWordIndex ? 100 : -1

  if (wordIndex === activeWordIndex) {
    // Currently active — enter: percentage goes 0 → 100
    const timeSinceActive = currentTimeSec - wordStart
    const progress = Math.min(1, Math.max(0, timeSinceActive / enterDurationSec))
    return progress * 100
  }

  if (wordIndex < activeWordIndex) {
    // Previously active — exit: reversed (100 → 0)
    const deactivatedAt = words[wordIndex + 1]?.start ?? words[wordIndex].end
    const exitDurationSec = enterDurationSec  // same duration as enter
    const timeSinceDeactivated = currentTimeSec - deactivatedAt
    const exitProgress = Math.min(1, Math.max(0, timeSinceDeactivated / exitDurationSec))
    return (1 - exitProgress) * 100
  }

  return -1
}

/**
 * Interpolate highlight keyframe tracks at a given frame and return CSS styles.
 */
function computeHighlightKeyframeStyles(
  tracks: KeyframeTrack[],
  frame: number,
): React.CSSProperties {
  if (tracks.length === 0 || frame < 0) return {}

  const result: React.CSSProperties = {}
  const transforms: string[] = []

  for (const track of tracks) {
    const kfs = track.keyframes
    if (kfs.length === 0) continue

    // Interpolate value at frame
    let value: number
    if (kfs.length === 1) {
      value = kfs[0].value
    } else if (frame <= kfs[0].time) {
      value = kfs[0].value
    } else if (frame >= kfs[kfs.length - 1].time) {
      value = kfs[kfs.length - 1].value
    } else {
      // Find segment
      let seg = 0
      for (let i = 0; i < kfs.length - 1; i++) {
        if (frame <= kfs[i + 1].time) { seg = i; break }
      }
      const t0 = kfs[seg].time, t1 = kfs[seg + 1].time
      const p = t1 === t0 ? 1 : (frame - t0) / (t1 - t0)
      value = kfs[seg].value + (kfs[seg + 1].value - kfs[seg].value) * p
    }

    switch (track.property) {
      case 'scale':
        transforms.push(`scale(${value})`)
        break
      case 'y':
        transforms.push(`translateY(${value}px)`)
        break
      case 'x':
        transforms.push(`translateX(${value}px)`)
        break
      case 'rotation':
        transforms.push(`rotate(${value}deg)`)
        break
      case 'opacity':
        result.opacity = value
        break
    }
  }

  if (transforms.length > 0) {
    result.transform = transforms.join(' ')
    result.display = 'inline-block'
  }

  return result
}

interface SubtitleOverlayProps {
  phrases: CompositionPhrase[]
  style: StyleProps
  speakerStyles: Record<string, SpeakerStyleOverride>
  animationPreset?: AnimationPreset  // global default animation preset for all phrases
  speakerLanes?: Record<string, { verticalPosition: number }>  // per-speaker fixed vertical positions
  overlapGap?: number      // % points between same-speaker stacked rows (default 8)
  maxVisibleRows?: number  // max simultaneous speaker rows visible (default 4)
  showSpeakerBorders?: boolean  // show colored borders per-speaker (editor preview only)
}

export function SubtitleOverlay({ phrases, style, speakerStyles, animationPreset, speakerLanes: speakerLanesProp, overlapGap: overlapGapProp, maxVisibleRows: maxVisibleRowsProp, showSpeakerBorders }: SubtitleOverlayProps) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const currentTimeSec = frame / fps
  const effectiveSpeakerLanes = speakerLanesProp ?? {}
  const effectiveOverlapGap = overlapGapProp ?? 8
  const effectiveMaxVisibleRows = maxVisibleRowsProp ?? 4

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
  // Only keep the latest phrase per speaker
  let visiblePhrases = activePhrases.filter((phrase) => {
    const speaker = phrase.dominantSpeaker ?? '__default__'
    return latestBySpeaker.get(speaker) === phrase
  })

  // Apply maxVisibleRows cap: sort by start time descending (newest first) and take N
  if (visiblePhrases.length > effectiveMaxVisibleRows) {
    visiblePhrases = [...visiblePhrases]
      .sort((a, b) => b.words[0].start - a.words[0].start)
      .slice(0, effectiveMaxVisibleRows)
  }

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

        // Highlight animation config (if any)
        const hlConfig = (activePhrase.animationPreset ?? animationPreset)?.highlightAnimation

        // Determine the phrase's effective animation preset:
        // per-phrase resolved preset takes priority over global default
        const effectivePreset: AnimationPreset | undefined = activePhrase.animationPreset ?? animationPreset

        // Fixed lane-based positioning: each speaker has a permanent vertical position
        // sameSlotOffset is always 0 since we only keep the latest phrase per speaker
        const top = getLanePosition(
          activePhrase,
          effectiveSpeakerLanes,
          effectiveStyle.verticalPosition,
          effectiveOverlapGap,
          0,
        )

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

        const hasPositionKeyframes = (() => {
          const kf = effectivePreset?.keyframeTracks
          if (!kf) return false
          if (isLegacyKeyframeTracks(kf)) {
            return kf.some((t) => t.property === 'x' || t.property === 'y')
          }
          // KeyframePhases: check all phases for x/y tracks
          const allTracks = [...kf.enter.tracks, ...kf.active.tracks, ...kf.exit.tracks]
          return allTracks.some((t) => t.property === 'x' || t.property === 'y')
        })()

        // Only compute and merge keyframe styles at container level for word-scope
        // (phrase-scope already has them merged inside cleanPhraseAnimStyles).
        const hasAnyKeyframes = (() => {
          const kf = effectivePreset?.keyframeTracks
          if (!kf) return false
          if (isLegacyKeyframeTracks(kf)) return kf.length > 0
          return kf.enter.tracks.length > 0 || kf.active.tracks.length > 0 || kf.exit.tracks.length > 0
        })()
        const containerKeyframeStyles: React.CSSProperties =
          (effectivePreset?.scope === 'word' && hasAnyKeyframes)
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

        // Speaker-colored border for editor preview
        if (showSpeakerBorders && activePhrase.dominantSpeaker) {
          const speakerColor = getSpeakerColor(activePhrase.dominantSpeaker)
          containerStyle.outline = `3px solid ${speakerColor}cc`
          containerStyle.outlineOffset = '5px'
          containerStyle.borderRadius = '4px'
        }

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

                  // Highlight animation for stroke layer
                  const hlPctStroke = hlConfig
                    ? computeHighlightPct(i, activeWordIndex, activePhrase.words, currentTimeSec, hlConfig)
                    : -1
                  const hlStylesStroke = hlPctStroke >= 0 && hlConfig
                    ? computeHighlightKeyframeStyles(hlConfig.enterTracks, hlPctStroke)
                    : {}

                  return (
                    <span
                      key={`${word.start}-${i}`}
                      style={{
                        color: effectiveStyle.strokeColor,
                        marginRight: '0.25em',
                        WebkitTextStroke: `${effectiveStyle.strokeWidth * 2}px ${effectiveStyle.strokeColor}`,
                        ...cleanWordAnimStyles,
                        ...hlStylesStroke,
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

              // Highlight keyframe animation styles for this word
              const hlPct = hlConfig
                ? computeHighlightPct(i, activeWordIndex, activePhrase.words, currentTimeSec, hlConfig)
                : -1
              const hlStyles = hlPct >= 0 && hlConfig
                ? computeHighlightKeyframeStyles(hlConfig.enterTracks, hlPct)
                : {}

              const wordColor = i === activeWordIndex ? effectiveStyle.highlightColor : effectiveStyle.baseColor

              return (
                <span
                  key={`${word.start}-${i}`}
                  style={{
                    position: 'relative',
                    color: wordColor,
                    marginRight: '0.25em',
                    textShadow: `${effectiveStyle.shadowOffsetX ?? 0}px ${effectiveStyle.shadowOffsetY ?? 2}px ${effectiveStyle.shadowBlur ?? 4}px ${effectiveStyle.shadowColor ?? '#000000'}`,
                    ...cleanWordAnimStyles,
                    ...hlStyles,
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
