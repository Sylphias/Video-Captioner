import React, { useRef, useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import { Player } from '@remotion/player'
import type { PlayerRef } from '@remotion/player'
import { AbsoluteFill } from 'remotion'
import { SubtitleOverlay } from '@eigen/remotion-composition'
import type { StyleProps, SpeakerStyleOverride, CompositionPhrase } from '@eigen/remotion-composition'
import type { AnimationPreset } from '@eigen/shared-types'
import { useBuilderStore } from './useBuilderStore'
import { MotionPathOverlay } from './MotionPathOverlay'
import { KeyframeDrawer } from './KeyframeDrawer'
import './KeyframePreview.css'

// ─── Aspect ratio dimensions ───────────────────────────────────────────────────

type AspectRatio = '16:9' | '9:16' | '1:1'

const ASPECT_RATIOS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 640, height: 360 },
  '9:16': { width: 360, height: 640 },
  '1:1':  { width: 480, height: 480 },
}

// ─── Preview constants ─────────────────────────────────────────────────────────

const PREVIEW_DURATION_SEC = 5
// Phrase runs from 0.5s to 4.0s
const PHRASE_START_SEC = 0.5
const PHRASE_END_SEC = 4.0

const PREVIEW_STYLE: StyleProps = {
  highlightColor: '#FFFF00',
  baseColor: '#FFFFFF',
  fontSize: 24,
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
  laneGap: 8,
}

const EMPTY_SPEAKER_STYLES: Record<string, SpeakerStyleOverride> = {}

// ─── Inner composition ─────────────────────────────────────────────────────────

interface BuilderPreviewCompositionProps {
  preset: AnimationPreset | null
  sampleText: string
}

function BuilderPreviewComposition({ preset, sampleText }: BuilderPreviewCompositionProps) {
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
  const canvasRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [canvasHeight, setCanvasHeight] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  const preset = useBuilderStore((s) => s.preset)
  const scope = useBuilderStore((s) => s.scope)
  const staggerFrames = useBuilderStore((s) => s.staggerFrames)
  const highlightEnterTracks = useBuilderStore((s) => s.highlightEnterTracks)
  const highlightEnterPct = useBuilderStore((s) => s.highlightEnterPct)
  const fps = useBuilderStore((s) => s.fps)
  const sampleText = useBuilderStore((s) => s.sampleText)
  const setSampleText = useBuilderStore((s) => s.setSampleText)
  const aspectRatio = useBuilderStore((s) => s.aspectRatio)
  const setAspectRatio = useBuilderStore((s) => s.setAspectRatio)
  const showMotionPath = useBuilderStore((s) => s.showMotionPath)
  const setShowMotionPath = useBuilderStore((s) => s.setShowMotionPath)
  const editMode = useBuilderStore((s) => s.editMode)
  const selectedPhase = useBuilderStore((s) => s.selectedPhase)
  const enterDurationFrames = useBuilderStore((s) => s.enterDurationFrames)
  const activeCycleDurationFrames = useBuilderStore((s) => s.activeCycleDurationFrames)
  const setPlayheadFrame = useBuilderStore((s) => s.setPlayheadFrame)
  const playheadFrame = useBuilderStore((s) => s.playheadFrame)
  const addKeyframe = useBuilderStore((s) => s.addKeyframe)
  const buildKeyframePhases = useBuilderStore((s) => s.buildKeyframePhases)
  const setSeekToPhaseFrame = useBuilderStore((s) => s.setSeekToPhaseFrame)
  const exitDurationFrames = useBuilderStore((s) => s.exitDurationFrames)

  // Subscribe to track data so workingPreset recomputes when keyframes change
  const enterTracks = useBuilderStore((s) => s.enterTracks)
  const activeTracks = useBuilderStore((s) => s.activeTracks)
  const exitTracks = useBuilderStore((s) => s.exitTracks)

  const previewFps = fps
  const previewDurationFrames = PREVIEW_DURATION_SEC * previewFps

  // Play/pause toggle
  const togglePlayPause = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (isPlaying) {
      player.pause()
    } else {
      player.play()
    }
  }, [isPlaying])

  // Listen for play/pause events from the Player.
  // Re-attach when Player remounts (key changes with aspectRatio/canvasHeight/previewFps).
  const playerKey = `${aspectRatio}-${canvasHeight}-${previewFps}`
  useEffect(() => {
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    // Small delay to let the new Player mount and populate the ref
    const timer = setTimeout(() => {
      const player = playerRef.current
      if (!player) return
      player.addEventListener('play', onPlay)
      player.addEventListener('pause', onPause)
      // Player has autoPlay, so it starts playing on mount
      setIsPlaying(true)
    }, 50)
    return () => {
      clearTimeout(timer)
      const player = playerRef.current
      if (player) {
        player.removeEventListener('play', onPlay)
        player.removeEventListener('pause', onPause)
      }
    }
  }, [playerKey])

  // Spacebar play/pause + Left/Right arrow frame stepping (only when not typing in an input)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        e.preventDefault()
        const store = useBuilderStore.getState()
        if (e.shiftKey) {
          store.redo()
        } else {
          store.undo()
        }
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlayPause()
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault()
        const state = useBuilderStore.getState()

        if (state.editMode === 'highlight') {
          // Highlight mode: step through 0-100% directly
          const delta = e.code === 'ArrowRight' ? 1 : -1
          const newPct = Math.max(0, Math.min(100, Math.round(state.playheadFrame) + delta))
          state.setPlayheadFrame(newPct)
          return
        }

        const seek = state.seekToPhaseFrame
        if (!seek) return
        const delta = e.code === 'ArrowRight' ? 1 : -1
        const maxFrame = state.currentPhaseDurationFrames()
        const newFrame = Math.max(0, Math.min(maxFrame, Math.round(state.playheadFrame) + delta))
        seek(newFrame)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [togglePlayPause])

  // Register seek callback so the timeline can seek the player
  useEffect(() => {
    const seekFn = (phaseFrame: number) => {
      const player = playerRef.current
      if (!player) return

      const state = useBuilderStore.getState()
      let phaseOffsetSec = 0

      if (state.editMode === 'hold') {
        // Hold mode: active phase starts after enter
        phaseOffsetSec = state.enterDurationFrames / state.fps
      } else {
        // Enter/Exit mode
        if (state.selectedPhase === 'exit') {
          phaseOffsetSec = (state.enterDurationFrames + state.activeCycleDurationFrames) / state.fps
        }
        // 'enter' offset is 0
      }

      const timeSec = PHRASE_START_SEC + phaseOffsetSec + (phaseFrame / state.fps)
      const compositionFrame = Math.round(timeSec * previewFps)
      player.seekTo(compositionFrame)
      player.pause()
    }
    setSeekToPhaseFrame(seekFn)
    return () => setSeekToPhaseFrame(null)
  }, [previewFps, setSeekToPhaseFrame])

  const { width: compWidth, height: compHeight } = ASPECT_RATIOS[aspectRatio]

  // Build a working preset that uses the current phase keyframe tracks
  const workingPreset = useMemo<AnimationPreset | null>(() => {
    const phases = buildKeyframePhases()
    const hasTracks = phases.enter.tracks.length > 0 || phases.active.tracks.length > 0 || phases.exit.tracks.length > 0

    if (!preset) {
      if (!hasTracks) return null
      const noPhase = { type: 'none' as const, durationSec: 0, easing: 'linear' as const, params: { staggerFrames } }
      const hlAnim = highlightEnterTracks.length > 0
        ? { enterPct: highlightEnterPct, enterTracks: highlightEnterTracks }
        : undefined
      return {
        id: '__builder__',
        name: 'Builder Preview',
        scope,
        isBuiltin: false,
        enter: noPhase,
        active: { type: 'none' as const, cycleDurationSec: 0, intensity: 0 },
        exit: { ...noPhase, mirrorEnter: false },
        highlightAnimation: hlAnim,
        createdAt: 0,
        updatedAt: 0,
        keyframeTracks: phases,
      } satisfies AnimationPreset
    }
    const hlAnim = highlightEnterTracks.length > 0
      ? { enterPct: highlightEnterPct, enterTracks: highlightEnterTracks }
      : undefined
    return {
      ...preset,
      scope,
      enter: { ...preset.enter, params: { ...preset.enter.params, staggerFrames } },
      highlightAnimation: hlAnim,
      keyframeTracks: phases,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- enterTracks/activeTracks/exitTracks trigger recompute when keyframes change
  }, [preset, scope, staggerFrames, highlightEnterTracks, highlightEnterPct, fps, buildKeyframePhases, enterTracks, activeTracks, exitTracks, enterDurationFrames, activeCycleDurationFrames, exitDurationFrames])

  // Force the Player to re-render the current frame when tracks/durations change while paused.
  // Remotion Player doesn't automatically re-render a paused frame when inputProps change.
  useEffect(() => {
    if (isPlaying) return
    const player = playerRef.current
    if (!player) return
    // Seek to the same frame to force a re-render
    const frame = player.getCurrentFrame()
    player.seekTo(frame)
  }, [enterTracks, activeTracks, exitTracks, enterDurationFrames, activeCycleDurationFrames, exitDurationFrames, highlightEnterTracks, highlightEnterPct, scope, staggerFrames, isPlaying])

  // Observe canvas container height
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setCanvasHeight(entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Compute Player style
  const playerStyle = useMemo<CSSProperties>(() => {
    if (canvasHeight <= 0) return { width: '100%', borderRadius: 6, display: 'block' }
    const arRatio = compWidth / compHeight
    const fitWidth = Math.floor(canvasHeight * arRatio)
    return {
      width: fitWidth,
      height: canvasHeight,
      borderRadius: 4,
      display: 'block',
      outline: '1px solid var(--color-border)',
    }
  }, [canvasHeight, compWidth, compHeight])

  const inputProps = useMemo<BuilderPreviewCompositionProps>(
    () => ({ preset: workingPreset, sampleText }),
    [workingPreset, sampleText],
  )

  // Poll the Remotion Player for current playhead time and compute frame within current phase
  // In highlight mode, playhead is controlled directly (percentage 0-100), not derived from Player.
  useEffect(() => {
    if (editMode === 'highlight') return
    function poll() {
      const player = playerRef.current
      if (player) {
        const frame = player.getCurrentFrame()
        const currentTimeSec = frame / previewFps
        const phraseSpan = PHRASE_END_SEC - PHRASE_START_SEC

        // Compute time into phrase
        const timeIntoPhrase = Math.max(0, currentTimeSec - PHRASE_START_SEC)
        const phraseTimeSec = Math.min(timeIntoPhrase, phraseSpan)

        // Convert to keyframe-space frame
        const kfFrame = phraseTimeSec * fps

        let frameInPhase: number

        if (editMode === 'hold') {
          // Hold mode: map entire phrase to active cycle (looping)
          frameInPhase = activeCycleDurationFrames > 0
            ? kfFrame % activeCycleDurationFrames
            : 0
        } else {
          // Enter/Exit mode: determine phase boundaries
          const enterEnd = enterDurationFrames
          const activeEnd = enterEnd + activeCycleDurationFrames

          if (kfFrame < enterEnd) {
            frameInPhase = selectedPhase === 'enter' ? kfFrame : 0
          } else if (kfFrame < activeEnd) {
            // In the active gap — clamp to boundary of selected phase
            frameInPhase = selectedPhase === 'enter' ? enterEnd : 0
          } else {
            frameInPhase = selectedPhase === 'exit' ? kfFrame - activeEnd : 0
          }
        }

        setPlayheadFrame(Math.max(0, frameInPhase))
      }
      rafRef.current = requestAnimationFrame(poll)
    }
    rafRef.current = requestAnimationFrame(poll)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [setPlayheadFrame, previewFps, fps, editMode, selectedPhase, enterDurationFrames, activeCycleDurationFrames])

  // Compute position from pointer event
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
        addKeyframe('x', playheadFrame, pos.xPct)
        addKeyframe('y', playheadFrame, pos.yPct)
      }
    },
    [computePosition, addKeyframe, playheadFrame],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      const pos = computePosition(e)
      if (pos) {
        addKeyframe('x', playheadFrame, pos.xPct)
        addKeyframe('y', playheadFrame, pos.yPct)
      }
    },
    [isDragging, computePosition, addKeyframe, playheadFrame],
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Compute playhead progress bar fraction
  const currentPhaseDuration = selectedPhase === 'enter' ? enterDurationFrames
    : selectedPhase === 'active' ? activeCycleDurationFrames
    : useBuilderStore.getState().exitDurationFrames
  const playheadFraction = currentPhaseDuration > 0 ? playheadFrame / currentPhaseDuration : 0

  return (
    <div className="keyframe-preview">
      {/* Toolbar */}
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

        <button
          type="button"
          className="keyframe-preview__play-btn"
          onClick={togglePlayPause}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>
      </div>

      {/* Canvas + Drawer */}
      <div ref={canvasRef} className="keyframe-preview__canvas">
        <KeyframeDrawer />
        <Player
          ref={playerRef}
          key={`${aspectRatio}-${canvasHeight}-${previewFps}`}
          component={BuilderPreviewComposition as unknown as React.ComponentType<Record<string, unknown>>}
          durationInFrames={previewDurationFrames}
          compositionWidth={compWidth}
          compositionHeight={compHeight}
          fps={previewFps}
          loop
          autoPlay
          style={playerStyle}
          inputProps={inputProps as unknown as Record<string, unknown>}
          acknowledgeRemotionLicense
        />

        {showMotionPath && (
          <MotionPathOverlay
            compositionWidth={compWidth}
            compositionHeight={compHeight}
          />
        )}

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
          style={{ width: `${Math.min(1, playheadFraction) * 100}%` }}
        />
      </div>
    </div>
  )
}
