import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Player } from '@remotion/player'
import type { PlayerRef } from '@remotion/player'
import { AbsoluteFill } from 'remotion'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import { SubtitleOverlay } from '@eigen/remotion-composition'
import type {
  StyleProps,
  SpeakerStyleOverride,
  CompositionPhrase,
  LookStyleProps,
} from '@eigen/remotion-composition'
import './StylePreview.css'

const STUDIO_PREVIEW_FPS = 30
// Frame 16 (~0.53 s) sits inside the second sample word, so that word is the highlighted one (D-04)
const STUDIO_PREVIEW_FRAME = 16
const STUDIO_PREVIEW_DURATION = 300
const DEFAULT_SAMPLE_TEXT = 'Make every word count'
const MAX_SAMPLE_WORDS = 12

const EMPTY_SPEAKER_STYLES: Record<string, SpeakerStyleOverride> = {}

// Layout is not part of a style (D-05); the preview uses fixed, neutral layout values.
const PREVIEW_LAYOUT = { verticalPosition: 50, laneGap: 8, lingerDuration: 1 }

type Backdrop = 'dark' | 'light' | 'checker' | 'custom'

const BACKDROPS: ReadonlyArray<{ id: Backdrop; label: string }> = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'checker', label: 'Checker' },
  { id: 'custom', label: 'Custom' },
]

function buildSamplePhrases(text: string): CompositionPhrase[] {
  let tokens = text.split(/\s+/).filter((t) => t.length > 0).slice(0, MAX_SAMPLE_WORDS)
  if (tokens.length === 0) tokens = ['Sample']
  return [
    {
      words: tokens.map((word, i) => ({
        word,
        start: i * 0.5,
        end: (i + 1) * 0.5,
        confidence: 1.0,
      })),
      dominantSpeaker: undefined,
    },
  ]
}

interface StudioPreviewCompositionProps {
  phrases: CompositionPhrase[]
  style: StyleProps
}

// Module-level so the Player does not remount on each render. No backgroundColor on the
// AbsoluteFill: the stage backdrop behind the Player shows through.
function StudioPreviewComposition({ phrases, style }: StudioPreviewCompositionProps) {
  return (
    <AbsoluteFill>
      <SubtitleOverlay phrases={phrases} style={style} speakerStyles={EMPTY_SPEAKER_STYLES} />
    </AbsoluteFill>
  )
}

export function StylePreview({ look }: { look: LookStyleProps }) {
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT)
  const [backdrop, setBackdrop] = useState<Backdrop>('dark')
  const [customColor, setCustomColor] = useState('#D9C2AE')
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const playerRef = useRef<PlayerRef>(null)

  const inputProps = useMemo(() => {
    const style: StyleProps = { ...look, ...PREVIEW_LAYOUT }
    return { phrases: buildSamplePhrases(sampleText), style }
  }, [look, sampleText])

  // A paused Player does not repaint when inputProps change; re-seek the same frame.
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    player.seekTo(player.getCurrentFrame())
  }, [inputProps])

  return (
    <div className="style-preview">
      <div className="style-preview__controls">
        <input
          type="text"
          className="style-preview__sample-input"
          value={sampleText}
          maxLength={80}
          placeholder="Type sample text"
          onChange={(e) => setSampleText(e.target.value)}
          aria-label="Sample text"
        />
        <div className="style-preview__backdrops" role="group" aria-label="Backdrop">
          {BACKDROPS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={'style-preview__backdrop-btn' + (backdrop === b.id ? ' style-preview__backdrop-btn--active' : '')}
              aria-pressed={backdrop === b.id}
              onClick={() => setBackdrop(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        {backdrop === 'custom' && (
          <div className="style-preview__custom">
            <button
              type="button"
              className="style-preview__swatch"
              style={{ backgroundColor: customColor }}
              aria-label="Pick backdrop colour"
              onClick={() => setShowCustomPicker((v) => !v)}
            />
            {showCustomPicker && (
              <div className="style-preview__popover">
                <HexColorPicker color={customColor} onChange={setCustomColor} />
                <HexColorInput
                  color={customColor}
                  onChange={setCustomColor}
                  prefixed
                  className="style-preview__hex-input"
                />
              </div>
            )}
          </div>
        )}
      </div>
      <div
        className={'style-preview__stage style-preview__stage--' + backdrop}
        style={backdrop === 'custom' ? { backgroundColor: customColor } : undefined}
      >
        <Player
          ref={playerRef}
          component={StudioPreviewComposition as unknown as React.ComponentType<Record<string, unknown>>}
          durationInFrames={STUDIO_PREVIEW_DURATION}
          compositionWidth={1920}
          compositionHeight={1080}
          fps={STUDIO_PREVIEW_FPS}
          initialFrame={STUDIO_PREVIEW_FRAME}
          controls={false}
          clickToPlay={false}
          spaceKeyToPlayOrPause={false}
          style={{ width: '100%' }}
          inputProps={inputProps as unknown as Record<string, unknown>}
          acknowledgeRemotionLicense
        />
      </div>
    </div>
  )
}
