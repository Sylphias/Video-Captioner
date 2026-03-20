import { interpolate, spring, Easing } from 'remotion'
import BezierEasing from 'bezier-easing'
import type { AnimationPreset, AnimationPhaseConfig, ActivePhaseConfig, EasingType, KeyframeTrack, KeyframeEasing, MotionKeyframe, KeyframePhases } from '@eigen/shared-types'
import { isLegacyKeyframeTracks } from '@eigen/shared-types'

// ─── Easing mapper ─────────────────────────────────────────────────────────────

function getEasingFn(easing: EasingType): (t: number) => number {
  switch (easing) {
    case 'linear':          return Easing.linear
    case 'ease-in':         return Easing.in(Easing.ease)
    case 'ease-out':        return Easing.out(Easing.ease)
    case 'ease-in-out':     return Easing.inOut(Easing.ease)
    case 'ease-in-cubic':   return Easing.in(Easing.cubic)
    case 'ease-out-cubic':  return Easing.out(Easing.cubic)
    case 'ease-in-out-cubic': return Easing.inOut(Easing.cubic)
    case 'bounce':          return Easing.bounce
    case 'elastic':         return Easing.elastic(1)
    case 'back':            return Easing.back(1.5)
    case 'spring':          return Easing.out(Easing.ease) // spring uses spring() directly — fallback ease-out
    default:                return Easing.out(Easing.ease)
  }
}

// ─── Enter phase ───────────────────────────────────────────────────────────────

function applyEnterAnimation(
  progress: number,
  config: AnimationPhaseConfig,
  frame: number,
  fps: number,
  width: number,
  height: number,
): React.CSSProperties {
  switch (config.type) {
    case 'none':
      return {}

    case 'fade':
      return { opacity: progress }

    case 'slide-up': {
      const offset = (config.params.slideOffsetFraction ?? 0.15) * height
      return {
        opacity: progress,
        transform: `translateY(${offset * (1 - progress)}px)`,
      }
    }

    case 'slide-down': {
      const offset = (config.params.slideOffsetFraction ?? 0.15) * height
      return {
        opacity: progress,
        transform: `translateY(${-offset * (1 - progress)}px)`,
      }
    }

    case 'slide-left': {
      const offset = (config.params.slideOffsetFraction ?? 0.15) * width
      return {
        opacity: progress,
        transform: `translateX(${offset * (1 - progress)}px)`,
      }
    }

    case 'slide-right': {
      const offset = (config.params.slideOffsetFraction ?? 0.15) * width
      return {
        opacity: progress,
        transform: `translateX(${-offset * (1 - progress)}px)`,
      }
    }

    case 'pop': {
      const springProgress = spring({
        frame,
        fps,
        config: { stiffness: 180, damping: 12, overshootClamping: false },
      })
      return {
        transform: `scale(${springProgress})`,
        opacity: springProgress > 0.01 ? 1 : 0,
      }
    }

    case 'bounce': {
      const springProgress = spring({
        frame,
        fps,
        config: { stiffness: 260, damping: 8, overshootClamping: false },
      })
      return {
        transform: `scale(${springProgress})`,
        opacity: springProgress > 0.01 ? 1 : 0,
      }
    }

    case 'fly-in': {
      const offset = (config.params.slideOffsetFraction ?? 0.5) * width
      return {
        opacity: progress,
        transform: `translateX(${offset * (1 - progress)}px)`,
      }
    }

    case 'shrink':
      return {
        transform: `scale(${1 + (1 - progress) * 0.5})`,
        opacity: progress,
      }

    case 'typewriter':
    case 'letter-by-letter':
      // Return special marker — handled by SubtitleOverlay text slicing
      return { ['--textSliceProgress' as string]: progress } as React.CSSProperties

    case 'word-cascade':
      // Handled at word-scope path; phrase-scope falls back to fade
      return { opacity: progress }

    case 'blur-reveal':
      return {
        filter: `blur(${(1 - progress) * 8}px)`,
        opacity: interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' }),
      }

    default:
      return {}
  }
}

// ─── Exit phase ────────────────────────────────────────────────────────────────

function applyExitAnimation(
  progress: number,
  config: AnimationPhaseConfig & { mirrorEnter: boolean },
  frame: number,
  fps: number,
  width: number,
  height: number,
): React.CSSProperties {
  if (config.mirrorEnter) {
    // Exit mirrors enter: progress goes 1 -> 0, so pass 1 - progress to enter
    return applyEnterAnimation(1 - progress, config, frame, fps, width, height)
  }

  // Non-mirrored exit uses the same mapping as enter (with inverted progress for direction-based types)
  return applyEnterAnimation(1 - progress, config, frame, fps, width, height)
}

// ─── Active phase ──────────────────────────────────────────────────────────────

function applyActiveAnimation(
  activeFrame: number,
  fps: number,
  config: ActivePhaseConfig,
  height: number,
): React.CSSProperties {
  if (config.type === 'none') return {}

  const cycleFrames = Math.max(1, Math.round(config.cycleDurationSec * fps))
  const t = (activeFrame % cycleFrames) / cycleFrames

  switch (config.type) {
    case 'jiggle': {
      const angle = config.intensity * 3 * Math.sin(t * 4 * Math.PI)
      return { transform: `rotate(${angle}deg)` }
    }

    case 'wave': {
      const dy = Math.sin(t * 2 * Math.PI) * config.intensity * height * 0.02
      return { transform: `translateY(${dy}px)` }
    }

    case 'pulse': {
      const scale = 1 + Math.sin(t * 2 * Math.PI) * config.intensity * 0.05
      return { transform: `scale(${scale})` }
    }

    case 'bounce': {
      const absVal = Math.abs(Math.sin(t * Math.PI))
      const dy = -absVal * config.intensity * height * 0.02
      return { transform: `translateY(${dy}px)` }
    }

    default:
      return {}
  }
}

// ─── Merge CSS properties (combine transforms carefully) ───────────────────────

function mergeStyles(...styles: React.CSSProperties[]): React.CSSProperties {
  // Collect transforms separately and combine them
  const transforms: string[] = []
  const merged: React.CSSProperties = {}

  for (const s of styles) {
    const { transform, ...rest } = s as React.CSSProperties & { transform?: string }
    Object.assign(merged, rest)
    if (transform) {
      transforms.push(transform)
    }
  }

  if (transforms.length > 0) {
    merged.transform = transforms.join(' ')
  }

  return merged
}

// ─── Frame clamping ────────────────────────────────────────────────────────────

function clampFrames(
  phraseStartSec: number,
  phraseEndSec: number,
  preset: AnimationPreset,
  fps: number,
): { enterFrames: number; exitFrames: number } {
  const totalPhraseFrames = Math.round((phraseEndSec - phraseStartSec) * fps)
  const maxEnterFrames = Math.floor(totalPhraseFrames * 0.45)
  const maxExitFrames = Math.floor(totalPhraseFrames * 0.45)
  const enterFrames = Math.min(Math.round(preset.enter.durationSec * fps), maxEnterFrames)
  const exitFrames = Math.min(Math.round(preset.exit.durationSec * fps), maxExitFrames)
  return { enterFrames, exitFrames }
}

// ─── Keyframe interpolation engine ──────────────────────────────────────────

function findKeyframeSegment(keyframes: MotionKeyframe[], t: number): number {
  // Find which segment [i, i+1] the time t falls into
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (t <= keyframes[i + 1].time) return i
  }
  return keyframes.length - 2 // clamp to last segment
}

function applyKeyframeEasing(t: number, easing: KeyframeEasing): number {
  switch (easing.type) {
    case 'linear': return t
    case 'ease-in': return Easing.in(Easing.ease)(t)
    case 'ease-out': return Easing.out(Easing.ease)(t)
    case 'ease-in-out': return Easing.inOut(Easing.ease)(t)
    case 'ease-in-cubic': return Easing.in(Easing.cubic)(t)
    case 'ease-out-cubic': return Easing.out(Easing.cubic)(t)
    case 'ease-in-out-cubic': return Easing.inOut(Easing.cubic)(t)
    case 'bounce': return Easing.bounce(t)
    case 'elastic': return Easing.elastic(1)(t)
    case 'bezier': {
      const fn = BezierEasing(easing.p1x, easing.p1y, easing.p2x, easing.p2y)
      return fn(t)
    }
    default: return t
  }
}

function interpolateTrack(track: KeyframeTrack, phraseProgress: number): number {
  const kfs = track.keyframes
  if (kfs.length === 0) return 0
  if (kfs.length === 1) return kfs[0].value

  // Clamp to track range
  if (phraseProgress <= kfs[0].time) return kfs[0].value
  if (phraseProgress >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value

  const segIdx = findKeyframeSegment(kfs, phraseProgress)
  const t0 = kfs[segIdx].time
  const t1 = kfs[segIdx + 1].time
  const v0 = kfs[segIdx].value
  const v1 = kfs[segIdx + 1].value
  const easing = track.easings[segIdx] ?? { type: 'linear' as const }

  const segProgress = t1 === t0 ? 1 : (phraseProgress - t0) / (t1 - t0)
  const easedProgress = applyKeyframeEasing(segProgress, easing)

  return v0 + (v1 - v0) * easedProgress
}

/**
 * Interpolate a track at a given frame number (integer).
 * Same logic as interpolateTrack but treats keyframe.time as a frame index.
 */
function interpolateTrackAtFrame(track: KeyframeTrack, frame: number): number {
  // Reuse interpolateTrack — frame acts as the "time" value
  return interpolateTrack(track, frame)
}

/**
 * Convert tracks to CSS properties for a set of tracks at a given frame.
 */
function tracksToStyles(
  tracks: KeyframeTrack[],
  time: number,
  width: number,
  height: number,
): React.CSSProperties {
  if (tracks.length === 0) return {}

  const result: React.CSSProperties = {}
  const transforms: string[] = []

  for (const track of tracks) {
    const value = interpolateTrack(track, time)

    switch (track.property) {
      case 'x':
        transforms.push(`translateX(${(value / 100) * width - width / 2}px)`)
        break
      case 'y':
        transforms.push(`translateY(${(value / 100) * height - height / 2}px)`)
        break
      case 'scale':
        transforms.push(`scale(${value})`)
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
  }

  return result
}

/**
 * Compute CSS properties from keyframe tracks at a given phrase progress.
 * Returns position (translate), scale, rotation, and opacity.
 * When keyframeTracks is undefined or empty, returns empty object (backward compatible).
 * Supports both legacy KeyframeTrack[] (percentage-based) and new KeyframePhases (frame-based).
 */
export function computeKeyframeStyles(
  keyframeTracks: KeyframePhases | KeyframeTrack[] | undefined,
  phraseProgress: number,
  width: number,
  height: number,
): React.CSSProperties {
  if (!keyframeTracks) return {}

  // Legacy flat array — percentage-based
  if (isLegacyKeyframeTracks(keyframeTracks)) {
    if (keyframeTracks.length === 0) return {}
    return tracksToStyles(keyframeTracks, phraseProgress, width, height)
  }

  // New KeyframePhases — caller should use computePhaseKeyframeStyles instead
  // This path is a fallback; it treats phraseProgress as a fraction across all three phases
  return computePhaseKeyframeStylesFromProgress(keyframeTracks, phraseProgress, width, height)
}

/**
 * Compute keyframe styles for the new three-phase system.
 * Given the current phase name and frame within that phase.
 */
export function computePhaseKeyframeStyles(
  phases: KeyframePhases,
  phaseName: 'enter' | 'active' | 'exit',
  frameInPhase: number,
  width: number,
  height: number,
): React.CSSProperties {
  const phaseData = phases[phaseName]
  const tracks = phaseData.tracks
  if (tracks.length === 0) return {}

  // For active phase, loop the frame within cycle duration
  let frame = frameInPhase
  if (phaseName === 'active') {
    const cycleDur = (phaseData as typeof phases.active).cycleDurationFrames
    if (cycleDur > 0) {
      frame = frameInPhase % cycleDur
    }
  }

  return tracksToStyles(tracks, frame, width, height)
}

/**
 * Fallback: compute phase keyframe styles from a 0-1 progress value.
 * Maps progress to the appropriate phase and frame.
 */
function computePhaseKeyframeStylesFromProgress(
  phases: KeyframePhases,
  phraseProgress: number,
  width: number,
  height: number,
): React.CSSProperties {
  const totalFrames = phases.enter.durationFrames + phases.active.cycleDurationFrames + phases.exit.durationFrames
  if (totalFrames === 0) return {}

  const currentFrame = phraseProgress * totalFrames
  const enterEnd = phases.enter.durationFrames
  const activeEnd = enterEnd + phases.active.cycleDurationFrames

  if (currentFrame < enterEnd) {
    return computePhaseKeyframeStyles(phases, 'enter', currentFrame, width, height)
  } else if (currentFrame < activeEnd) {
    return computePhaseKeyframeStyles(phases, 'active', currentFrame - enterEnd, width, height)
  } else {
    return computePhaseKeyframeStyles(phases, 'exit', currentFrame - activeEnd, width, height)
  }
}

// ─── Main exports ──────────────────────────────────────────────────────────────

/**
 * Compute animation CSS styles for a phrase-scope animation.
 * Returns CSS properties to apply to the phrase container.
 * Handles enter/active/exit phases with frame clamping.
 */
export function computeAnimationStyles(
  phraseStartSec: number,
  phraseEndSec: number,
  preset: AnimationPreset,
  frame: number,
  fps: number,
  width: number,
  height: number,
): React.CSSProperties {
  const phraseStartFrame = Math.round(phraseStartSec * fps)
  const phraseEndFrame = Math.round(phraseEndSec * fps)
  const frameIntoPhrase = frame - phraseStartFrame
  const totalPhraseFrames = phraseEndFrame - phraseStartFrame

  // Before enter: stay invisible. After exit: stay invisible during linger.
  if (frameIntoPhrase < 0) return { opacity: 0 }
  if (frameIntoPhrase > totalPhraseFrames) return { opacity: 0 }

  const { enterFrames, exitFrames } = clampFrames(phraseStartSec, phraseEndSec, preset, fps)

  // New KeyframePhases path: when present, use frame-based phase keyframes
  const kfData = preset.keyframeTracks
  const hasPhaseKeyframes = kfData && !isLegacyKeyframeTracks(kfData)

  let kfStyles: React.CSSProperties = {}

  if (hasPhaseKeyframes) {
    const phases = kfData as KeyframePhases
    // Convert composition frame to keyframe-fps frame
    const kfEnterFrames = phases.enter.durationFrames
    const kfExitFrames = phases.exit.durationFrames
    const kfFps = phases.fps

    // Map composition frameIntoPhrase to keyframe-space frame
    const kfFrame = (frameIntoPhrase / fps) * kfFps

    // Derive phase boundaries in keyframe-fps space
    const totalKfSec = totalPhraseFrames / fps
    const kfTotalFrames = totalKfSec * kfFps
    const kfActiveEnd = kfTotalFrames - kfExitFrames

    if (kfFrame < kfEnterFrames) {
      kfStyles = computePhaseKeyframeStyles(phases, 'enter', kfFrame, width, height)
    } else if (kfFrame < kfActiveEnd) {
      kfStyles = computePhaseKeyframeStyles(phases, 'active', kfFrame - kfEnterFrames, width, height)
    } else {
      kfStyles = computePhaseKeyframeStyles(phases, 'exit', kfFrame - kfActiveEnd, width, height)
    }
  } else {
    // Legacy percentage-based keyframes
    const phraseProgress = totalPhraseFrames > 0 ? frameIntoPhrase / totalPhraseFrames : 0
    kfStyles = computeKeyframeStyles(kfData, phraseProgress, width, height)
  }

  // Determine current phase for enter/active/exit animations
  let phaseStyles: React.CSSProperties

  if (frameIntoPhrase < enterFrames) {
    // Enter phase
    const enterProgress = enterFrames > 0
      ? interpolate(frameIntoPhrase, [0, enterFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: getEasingFn(preset.enter.easing),
        })
      : 1

    phaseStyles = applyEnterAnimation(enterProgress, preset.enter, frameIntoPhrase, fps, width, height)
  } else {
    const framesBeforeExit = totalPhraseFrames - exitFrames
    if (frameIntoPhrase >= framesBeforeExit) {
      // Exit phase
      const frameIntoExit = frameIntoPhrase - framesBeforeExit
      const exitProgress = exitFrames > 0
        ? interpolate(frameIntoExit, [0, exitFrames], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: getEasingFn(preset.exit.easing),
          })
        : 1

      phaseStyles = applyExitAnimation(exitProgress, preset.exit, frameIntoExit, fps, width, height)
    } else {
      // Active phase
      const activeFrame = frameIntoPhrase - enterFrames
      phaseStyles = applyActiveAnimation(activeFrame, fps, preset.active, height)
    }
  }

  return mergeStyles(phaseStyles, kfStyles)
}

/**
 * Compute animation CSS styles for a word within a word-scope animation.
 * Adds per-word stagger offset so words animate in sequence.
 */
export function computeWordAnimationStyles(
  wordIndex: number,
  wordCount: number,
  phraseStartSec: number,
  phraseEndSec: number,
  preset: AnimationPreset,
  frame: number,
  fps: number,
  width: number,
  height: number,
): React.CSSProperties {
  const staggerFrames = preset.enter.params.staggerFrames ?? 3
  const phraseStartFrame = Math.round(phraseStartSec * fps)
  const phraseEndFrame = Math.round(phraseEndSec * fps)
  const frameIntoPhrase = frame - phraseStartFrame
  const totalPhraseFrames = phraseEndFrame - phraseStartFrame

  // Before enter: stay invisible. After exit: stay invisible during linger.
  if (frameIntoPhrase < 0) return { opacity: 0 }
  if (frameIntoPhrase > totalPhraseFrames) return { opacity: 0 }

  const { enterFrames, exitFrames } = clampFrames(phraseStartSec, phraseEndSec, preset, fps)

  // Keyframe styles (same phase-aware logic as phrase-scope)
  const kfData = preset.keyframeTracks
  const hasPhaseKeyframes = kfData && !isLegacyKeyframeTracks(kfData)

  let kfStyles: React.CSSProperties = {}

  if (hasPhaseKeyframes) {
    const phases = kfData as KeyframePhases
    const kfFps = phases.fps
    const kfEnterFrames = phases.enter.durationFrames
    const kfExitFrames = phases.exit.durationFrames
    const kfFrame = (frameIntoPhrase / fps) * kfFps
    const totalKfSec = totalPhraseFrames / fps
    const kfTotalFrames = totalKfSec * kfFps
    const kfActiveEnd = kfTotalFrames - kfExitFrames

    if (kfFrame < kfEnterFrames) {
      kfStyles = computePhaseKeyframeStyles(phases, 'enter', kfFrame, width, height)
    } else if (kfFrame < kfActiveEnd) {
      kfStyles = computePhaseKeyframeStyles(phases, 'active', kfFrame - kfEnterFrames, width, height)
    } else {
      kfStyles = computePhaseKeyframeStyles(phases, 'exit', kfFrame - kfActiveEnd, width, height)
    }
  } else {
    const phraseProgress = totalPhraseFrames > 0 ? frameIntoPhrase / totalPhraseFrames : 0
    kfStyles = computeKeyframeStyles(kfData, phraseProgress, width, height)
  }

  // Apply stagger offset: earlier words start earlier
  const staggeredFrame = Math.max(0, frameIntoPhrase - wordIndex * staggerFrames)

  let phaseStyles: React.CSSProperties

  if (staggeredFrame < enterFrames) {
    // Enter phase (with stagger)
    const enterProgress = enterFrames > 0
      ? interpolate(staggeredFrame, [0, enterFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: getEasingFn(preset.enter.easing),
        })
      : 1

    phaseStyles = applyEnterAnimation(enterProgress, preset.enter, staggeredFrame, fps, width, height)
  } else {
    const framesBeforeExit = totalPhraseFrames - exitFrames
    if (frameIntoPhrase >= framesBeforeExit) {
      // Exit phase (no stagger for exit — all words exit together)
      const frameIntoExit = frameIntoPhrase - framesBeforeExit
      const exitProgress = exitFrames > 0
        ? interpolate(frameIntoExit, [0, exitFrames], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: getEasingFn(preset.exit.easing),
          })
        : 1

      phaseStyles = applyExitAnimation(exitProgress, preset.exit, frameIntoExit, fps, width, height)
    } else {
      // Active phase
      const activeFrame = frameIntoPhrase - enterFrames
      phaseStyles = applyActiveAnimation(activeFrame, fps, preset.active, height)
    }
  }

  return mergeStyles(phaseStyles, kfStyles)
}

// Export mergeStyles for use in SubtitleOverlay
export { mergeStyles }
