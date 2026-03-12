import { interpolate, spring, Easing } from 'remotion'
import type { AnimationPreset, AnimationPhaseConfig, ActivePhaseConfig, EasingType } from '@eigen/shared-types'

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

  // Determine current phase
  if (frameIntoPhrase < enterFrames) {
    // Enter phase
    const enterProgress = enterFrames > 0
      ? interpolate(frameIntoPhrase, [0, enterFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: getEasingFn(preset.enter.easing),
        })
      : 1

    return applyEnterAnimation(enterProgress, preset.enter, frameIntoPhrase, fps, width, height)
  }

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

    return applyExitAnimation(exitProgress, preset.exit, frameIntoExit, fps, width, height)
  }

  // Active phase
  const activeFrame = frameIntoPhrase - enterFrames
  return applyActiveAnimation(activeFrame, fps, preset.active, height)
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

  // Apply stagger offset: earlier words start earlier
  const staggeredFrame = Math.max(0, frameIntoPhrase - wordIndex * staggerFrames)

  if (staggeredFrame < enterFrames) {
    // Enter phase (with stagger)
    const enterProgress = enterFrames > 0
      ? interpolate(staggeredFrame, [0, enterFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: getEasingFn(preset.enter.easing),
        })
      : 1

    return applyEnterAnimation(enterProgress, preset.enter, staggeredFrame, fps, width, height)
  }

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

    return applyExitAnimation(exitProgress, preset.exit, frameIntoExit, fps, width, height)
  }

  // Active phase
  const activeFrame = frameIntoPhrase - enterFrames
  return applyActiveAnimation(activeFrame, fps, preset.active, height)
}

// Export mergeStyles for use in SubtitleOverlay
export { mergeStyles }
