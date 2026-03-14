import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Player } from '@remotion/player'
import type { PlayerRef } from '@remotion/player'
import { AbsoluteFill } from 'remotion'
import { SubtitleOverlay } from '@eigen/remotion-composition'
import type { StyleProps, SpeakerStyleOverride, CompositionPhrase } from '@eigen/remotion-composition'
import type { AnimationPreset } from '@eigen/shared-types'
import { useBuilderStore } from './useBuilderStore'
import { MotionPathOverlay } from './MotionPathOverlay'
import './KeyframePreview.css'

// ─── Aspect ratio dimensions ───────────────────────────────────────────────────

type AspectRatio = '16:9' | '9:16' | '1:1'

const ASPECT_RATIOS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 640, height: 360 },
  '9:16': { width: 360, height: 640 },
  '1:1':  { width: 480, height: 480 },
}

// ─── Preview constants ─────────────────────────────────────────────────────────

const PREVIEW_FPS = 30
const PREVIEW_DURATION_SEC = 5
const PREVIEW_DURATION_FRAMES = PREVIEW_DURATION_SEC * PREVIEW_FPS
// Phrase runs from 0.5s to 4.0s (frames 15-120)
const PHRASE_START_SEC = 0.5
const PHRASE_END_SEC = 4.0

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
  verticalPosition: 75,
  lingerDuration: 1.0,
}

const EMPTY_SPEAKER_STYLES: Record<string, SpeakerStyleOverride> = {}

// ─── Inner composition (defined outside to avoid recreation on each render) ───

interface BuilderPreviewCompositionProps {
  preset: AnimationPreset | null
  sampleText: string
}

function BuilderPreviewComposition({ preset, sampleText }: BuilderPreviewCompositionProps) {
  // Build sample phrases from sampleText
  const words = sampleText.trim().split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const phraseSpan = PHRASE_END_SEC - PHRASE_START_SEC
  const wordDuration = wordCount > 0 ? phraseSpan / wordCount : phraseSpan

  const phrases: CompositionPhrase[] = [
    {
      words: words.map((word, i) => ({
        word,
        start: PHRASE_START_SEC + i * wordDuration,
        end: PHRASE_START_SEC + (i + 1) * wordDuration,
        confidence: 1.0,
      })),
      dominantSpeaker: undefined,
      lingerDuration: 0.5,
      animationPreset: preset ?? undefined,
    },
  ]

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a1a' }}>
      <SubtitleOverlay
        phrases={phrases}
        style={PREVIEW_STYLE}
        speakerStyles={EMPTY_SPEAKER_STYLES}
        animationPreset={preset ?? undefined}
      />
    </AbsoluteFill>
  )
}

// ─── KeyframePreview ──────────────────────────────────────────────────────────

export function KeyframePreview() {
  const playerRef = useRef<PlayerRef>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const preset = useBuilderStore((s) => s.preset)
  const sampleText = useBuilderStore((s) => s.sampleText)
  const setSampleText = useBuilderStore((s) => s.setSampleText)
  const aspectRatio = useBuilderStore((s) => s.aspectRatio)
  const setAspectRatio = useBuilderStore((s) => s.setAspectRatio)
  const showMotionPath = useBuilderStore((s) => s.showMotionPath)
  const setShowMotionPath = useBuilderStore((s) => s.setShowMotionPath)
  const playheadProgress = useBuilderStore((s) => s.playheadProgress)
  const setPlayheadProgress = useBuilderStore((s) => s.setPlayheadProgress)
  const addKeyframe = useBuilderStore((s) => s.addKeyframe)

  const { width: compWidth, height: compHeight } = ASPECT_RATIOS[aspectRatio]

  // Memoize inputProps — always defined (preset can be null)
  const inputProps = useMemo<BuilderPreviewCompositionProps>(
    () => ({ preset, sampleText }),
    [preset, sampleText],
  )

  // Poll the Remotion Player for current playhead time via requestAnimationFrame
  useEffect(() => {
    function poll() {
      const player = playerRef.current
      if (player) {
        const frame = player.getCurrentFrame()
        // Normalize to phrase lifetime [0, 1]: frame maps to seconds, then to phrase fraction
        const currentTimeSec = frame / PREVIEW_FPS
        const phraseSpan = PHRASE_END_SEC - PHRASE_START_SEC
        const progress = Math.max(0, Math.min(1, (currentTimeSec - PHRASE_START_SEC) / phraseSpan))
        setPlayheadProgress(progress)
      }
      rafRef.current = requestAnimationFrame(poll)
    }
    rafRef.current = requestAnimationFrame(poll)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [setPlayheadProgress])

  // Compute position percentage from a pointer event relative to the overlay
  const computePosition = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): { xPct: number; yPct: number } | null => {
      const overlay = overlayRef.current
      if (!overlay) return null
      const rect = overlay.getBoundingClientRect()
      const xPct = ((e.clientX - rect.left) / rect.width) * 100
      const yPct = ((e.clientY - rect.top) / rect.height) * 100
      return { xPct, yPct }
    },
    [],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      setIsDragging(true)
      const pos = computePosition(e)
      if (pos) {
        addKeyframe('x', playheadProgress, pos.xPct)
        addKeyframe('y', playheadProgress, pos.yPct)
      }
    },
    [computePosition, addKeyframe, playheadProgress],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      const pos = computePosition(e)
      if (pos) {
        addKeyframe('x', playheadProgress, pos.xPct)
        addKeyframe('y', playheadProgress, pos.yPct)
      }
    },
    [isDragging, computePosition, addKeyframe, playheadProgress],
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  return (
    <div className="keyframe-preview">
      {/* Toolbar: aspect ratio + sample text + motion path toggle */}
      <div className="keyframe-preview__toolbar">
        <div className="keyframe-preview__aspect-group">
          {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ar) => (
            <button
              key={ar}
              className={`keyframe-preview__aspect-btn${aspectRatio === ar ? ' keyframe-preview__aspect-btn--active' : ''}`}
              onClick={() => setAspectRatio(ar)}
              type="button"
            >
              {ar}
            </button>
          ))}
        </div>

        <input
          className="keyframe-preview__sample-input"
          type="text"
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
          placeholder="Sample text..."
          aria-label="Sample preview text"
        />

        <label className="keyframe-preview__toggle">
          <input
            type="checkbox"
            checked={showMotionPath}
            onChange={(e) => setShowMotionPath(e.target.checked)}
          />
          Motion path
        </label>
      </div>

      {/* Canvas: Player + overlays */}
      <div className="keyframe-preview__canvas">
        <Player
          ref={playerRef}
          key={aspectRatio}
          component={BuilderPreviewComposition as unknown as React.ComponentType<Record<string, unknown>>}
          durationInFrames={PREVIEW_DURATION_FRAMES}
          compositionWidth={compWidth}
          compositionHeight={compHeight}
          fps={PREVIEW_FPS}
          loop
          autoPlay
          style={{ width: '100%', borderRadius: 6, display: 'block' }}
          inputProps={inputProps as unknown as Record<string, unknown>}
          acknowledgeRemotionLicense
        />

        {/* Motion path SVG overlay — pointer-events: none, passes clicks through */}
        {showMotionPath && (
          <MotionPathOverlay
            compositionWidth={compWidth}
            compositionHeight={compHeight}
          />
        )}

        {/* Drag overlay — catches pointer events for drag-to-position */}
        <div
          ref={overlayRef}
          className="keyframe-preview__drag-overlay"
          style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      {/* Playhead progress indicator */}
      <div className="keyframe-preview__progress-bar">
        <div
          className="keyframe-preview__progress-fill"
          style={{ width: `${playheadProgress * 100}%` }}
        />
      </div>
    </div>
  )
}
