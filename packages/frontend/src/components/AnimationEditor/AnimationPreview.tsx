import React, { useMemo } from 'react'
import { Player } from '@remotion/player'
import { AbsoluteFill } from 'remotion'
import { SubtitleOverlay } from '@eigen/remotion-composition'
import type { StyleProps, SpeakerStyleOverride, CompositionPhrase } from '@eigen/remotion-composition'
import type { AnimationPreset } from '@eigen/shared-types'
import './AnimationPreview.css'

interface AnimationPreviewProps {
  preset: AnimationPreset | null
}

// Default style for the preview — clean, readable on dark background
const PREVIEW_STYLE: StyleProps = {
  highlightColor: '#FFFF00',
  baseColor: '#FFFFFF',
  fontSize: 36,
  fontFamily: 'Inter',
  fontWeight: 700,
  strokeColor: '#000000',
  strokeWidth: 2,
  shadowColor: '#000000',
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  shadowBlur: 4,
  letterSpacing: 0,
  wordSpacing: 0,
  verticalPosition: 75,
  lingerDuration: 1.0,
  laneGap: 8,
}

const EMPTY_SPEAKER_STYLES: Record<string, SpeakerStyleOverride> = {}

// Sample phrase words timed for a 4-second loop
// Phrase runs from 0.3s to 2.5s, giving time for enter and exit animations
const SAMPLE_PHRASES: CompositionPhrase[] = [
  {
    words: [
      { word: 'Sample', start: 0.3, end: 0.7, confidence: 1.0 },
      { word: 'subtitle', start: 0.7, end: 1.2, confidence: 1.0 },
      { word: 'text', start: 1.2, end: 1.6, confidence: 1.0 },
      { word: 'here', start: 1.6, end: 2.0, confidence: 1.0 },
    ],
    dominantSpeaker: undefined,
    lingerDuration: 0.5,
    animationPreset: undefined,  // will be overridden by global preset prop
  },
]

// Preview FPS and dimensions
const PREVIEW_FPS = 30
const PREVIEW_WIDTH = 640
const PREVIEW_HEIGHT = 200
const PREVIEW_DURATION_SEC = 4
const PREVIEW_DURATION_FRAMES = PREVIEW_DURATION_SEC * PREVIEW_FPS

// Inner composition rendered inside the Player
// Must be defined outside AnimationPreview to avoid recreation on each render
interface PreviewCompositionProps {
  preset: AnimationPreset
  style: StyleProps
  speakerStyles: Record<string, SpeakerStyleOverride>
  phrases: CompositionPhrase[]
}

function PreviewComposition({ preset, style, speakerStyles, phrases }: PreviewCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a1a' }}>
      <SubtitleOverlay
        phrases={phrases}
        style={style}
        speakerStyles={speakerStyles}
        animationPreset={preset}
      />
    </AbsoluteFill>
  )
}

export function AnimationPreview({ preset }: AnimationPreviewProps) {
  // Memoize inputProps keyed on the preset object to prevent excessive Player re-renders
  // (Pitfall #5 from research: always memoize inputProps)
  const inputProps = useMemo<PreviewCompositionProps | null>(() => {
    if (!preset) return null
    return {
      preset,
      style: PREVIEW_STYLE,
      speakerStyles: EMPTY_SPEAKER_STYLES,
      phrases: SAMPLE_PHRASES,
    }
  }, [preset])

  if (!preset || !inputProps) {
    return (
      <div className="animation-preview animation-preview--empty">
        <p className="animation-preview__placeholder">Select a preset to preview</p>
      </div>
    )
  }

  return (
    <div className="animation-preview">
      <Player
        component={PreviewComposition as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={PREVIEW_DURATION_FRAMES}
        compositionWidth={PREVIEW_WIDTH}
        compositionHeight={PREVIEW_HEIGHT}
        fps={PREVIEW_FPS}
        loop
        autoPlay
        style={{ width: '100%', borderRadius: 6 }}
        inputProps={inputProps as unknown as Record<string, unknown>}
        acknowledgeRemotionLicense
      />
    </div>
  )
}
