import { useCallback, useRef, useState, useEffect, useMemo } from 'react'
import type { KeyframeableProperty, KeyframeFps } from '@eigen/shared-types'
import { useBuilderStore } from './useBuilderStore'
import { KeyframeTrackRow } from './KeyframeTrackRow'
import './KeyframeTimeline.css'

const ALL_PROPERTIES: KeyframeableProperty[] = ['x', 'y', 'scale', 'rotation', 'opacity']

const DEFAULT_VALUES: Record<KeyframeableProperty, number> = {
  x: 50,
  y: 75,
  scale: 1,
  rotation: 0,
  opacity: 1,
}

const FPS_OPTIONS: KeyframeFps[] = [24, 30, 60]

type PhaseName = 'enter' | 'active' | 'exit'

const PHASE_LABELS: Record<PhaseName, string> = {
  enter: 'Enter',
  active: 'Hold',
  exit: 'Exit',
}

/** Number input that allows clearing while typing — commits on blur/Enter. */
function FrameInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  // Sync draft from prop when not focused
  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  const commit = () => {
    const v = parseInt(draft, 10)
    if (!isNaN(v) && v >= 1) {
      onChange(v)
    } else {
      setDraft(String(value)) // revert
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className="keyframe-timeline__phase-frames-input"
      value={draft}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => { setFocused(true); e.target.select() }}
      onBlur={() => { setFocused(false); commit() }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
      onChange={(e) => setDraft(e.target.value)}
      aria-label={label}
    />
  )
}

// Zoom constraints: pixels per frame
const MIN_PX_PER_FRAME = 8
const MAX_PX_PER_FRAME = 80
const DEFAULT_PX_PER_FRAME = 20

export function KeyframeTimeline() {
  const fps = useBuilderStore((s) => s.fps)
  const setFps = useBuilderStore((s) => s.setFps)
  const editMode = useBuilderStore((s) => s.editMode)
  const selectedPhase = useBuilderStore((s) => s.selectedPhase)
  const setSelectedPhase = useBuilderStore((s) => s.setSelectedPhase)
  const enterDurationFrames = useBuilderStore((s) => s.enterDurationFrames)
  const setEnterDurationFrames = useBuilderStore((s) => s.setEnterDurationFrames)
  const activeCycleDurationFrames = useBuilderStore((s) => s.activeCycleDurationFrames)
  const setActiveCycleDurationFrames = useBuilderStore((s) => s.setActiveCycleDurationFrames)
  const exitDurationFrames = useBuilderStore((s) => s.exitDurationFrames)
  const setExitDurationFrames = useBuilderStore((s) => s.setExitDurationFrames)
  const enterTracks = useBuilderStore((s) => s.enterTracks)
  const activeTracks = useBuilderStore((s) => s.activeTracks)
  const exitTracks = useBuilderStore((s) => s.exitTracks)
  const highlightEnterTracks = useBuilderStore((s) => s.highlightEnterTracks)
  const highlightEnterPct = useBuilderStore((s) => s.highlightEnterPct)
  const setHighlightEnterPct = useBuilderStore((s) => s.setHighlightEnterPct)
  const playheadFrame = useBuilderStore((s) => s.playheadFrame)
  const selectedProperty = useBuilderStore((s) => s.selectedProperty)
  const selectedKeyframeIndex = useBuilderStore((s) => s.selectedKeyframeIndex)
  const setSelectedProperty = useBuilderStore((s) => s.setSelectedProperty)
  const setSelectedKeyframeIndex = useBuilderStore((s) => s.setSelectedKeyframeIndex)
  const addKeyframe = useBuilderStore((s) => s.addKeyframe)
  const removeKeyframe = useBuilderStore((s) => s.removeKeyframe)
  const updateKeyframeTime = useBuilderStore((s) => s.updateKeyframeTime)
  const updateKeyframeValue = useBuilderStore((s) => s.updateKeyframeValue)
  const setTrackEasing = useBuilderStore((s) => s.setTrackEasing)
  const seekToPhaseFrame = useBuilderStore((s) => s.seekToPhaseFrame)

  // Current phase's tracks and duration (highlight mode uses its own tracks)
  const currentTracks = editMode === 'highlight' ? highlightEnterTracks
    : selectedPhase === 'enter' ? enterTracks
    : selectedPhase === 'active' ? activeTracks
    : exitTracks
  const phaseDurationFrames = editMode === 'highlight' ? 100  // percentage scale
    : selectedPhase === 'enter' ? enterDurationFrames
    : selectedPhase === 'active' ? activeCycleDurationFrames
    : exitDurationFrames

  // Visible phases based on edit mode
  const visiblePhases: PhaseName[] = editMode === 'hold' ? ['active']
    : editMode === 'highlight' ? ['enter']
    : ['enter', 'exit']

  // Total frames across visible phases (for phase selector proportions)
  const totalFrames = editMode === 'hold'
    ? activeCycleDurationFrames
    : editMode === 'highlight'
    ? 100
    : enterDurationFrames + exitDurationFrames

  // Selected keyframe object
  const selectedTrack = selectedProperty
    ? currentTracks.find((t) => t.property === selectedProperty)
    : undefined
  const selectedKeyframe =
    selectedTrack && selectedKeyframeIndex !== null
      ? selectedTrack.keyframes[selectedKeyframeIndex]
      : undefined

  // ─── Zoom & scroll state ──────────────────────────────────────────────
  const [pxPerFrame, setPxPerFrame] = useState(DEFAULT_PX_PER_FRAME)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Total scrollable width of the track area (in px)
  const trackContentWidth = Math.max(phaseDurationFrames * pxPerFrame, 1)

  // Ruler ticks — compute based on zoom level so they don't overlap
  const rulerTicks = useMemo(() => computeRulerTicks(phaseDurationFrames, pxPerFrame), [phaseDurationFrames, pxPerFrame])

  // Playhead position in pixels
  const playheadPx = playheadFrame * pxPerFrame

  // Handle Ctrl+Wheel for zoom, plain wheel for horizontal scroll
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    function handleWheel(e: WheelEvent) {
      // Ctrl/Meta + wheel = zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18
        setPxPerFrame((prev) => Math.min(MAX_PX_PER_FRAME, Math.max(MIN_PX_PER_FRAME, prev * zoomFactor)))
        return
      }

      // Horizontal scroll: if user scrolls vertically on the timeline, translate to horizontal
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaX === 0) {
        e.preventDefault()
        container!.scrollLeft += e.deltaY
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // Auto-fit: measure the scrollable container (not scroll-area) and fit content
  const zoomToFit = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || phaseDurationFrames <= 0) return
    // Measure the scrollable child's available width (subtract label column)
    const scrollable = container.querySelector('.keyframe-timeline__scrollable') as HTMLElement | null
    const availableWidth = (scrollable?.clientWidth ?? container.clientWidth) - 4
    if (availableWidth <= 0) return
    const fit = Math.min(MAX_PX_PER_FRAME, Math.max(MIN_PX_PER_FRAME, availableWidth / phaseDurationFrames))
    setPxPerFrame(fit)
    container.scrollLeft = 0
  }, [phaseDurationFrames])

  const handleZoomFit = zoomToFit

  // Auto-fit on mount, mode change, phase change, or duration change
  useEffect(() => {
    const id = requestAnimationFrame(zoomToFit)
    return () => cancelAnimationFrame(id)
  }, [zoomToFit, editMode, selectedPhase])

  // ─── Phase drag handles ────────────────────────────────────────────────
  const phaseBarRef = useRef<HTMLDivElement>(null)
  const [draggingHandle, setDraggingHandle] = useState<'enter-exit' | null>(null)

  const handlePhasePointerDown = useCallback(
    (handle: 'enter-exit', e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      setDraggingHandle(handle)
    },
    [],
  )

  const handlePhasePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingHandle || !phaseBarRef.current) return
      const rect = phaseBarRef.current.getBoundingClientRect()
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const frameAtCursor = Math.round(fraction * totalFrames)

      // In enter-exit mode: redistribute between enter and exit (totalFrames = enter + exit)
      const newEnter = Math.max(1, Math.min(frameAtCursor, totalFrames - 1))
      const newExit = Math.max(1, totalFrames - newEnter)
      setEnterDurationFrames(newEnter)
      setExitDurationFrames(newExit)
    },
    [draggingHandle, totalFrames, setEnterDurationFrames, setExitDurationFrames],
  )

  const handlePhasePointerUp = useCallback(() => {
    setDraggingHandle(null)
  }, [])

  // Click on ruler/track to seek to that frame
  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const px = e.clientX - rect.left
      const frame = Math.max(0, Math.min(phaseDurationFrames, Math.round(px / pxPerFrame)))
      if (seekToPhaseFrame) seekToPhaseFrame(frame)
    },
    [phaseDurationFrames, pxPerFrame, seekToPhaseFrame],
  )

  // Add keyframe at playhead
  const handleAddAtPlayhead = useCallback(() => {
    if (!selectedProperty) return
    addKeyframe(selectedProperty, playheadFrame, DEFAULT_VALUES[selectedProperty])
  }, [selectedProperty, playheadFrame, addKeyframe])

  // Delete selected
  const handleDeleteSelected = useCallback(() => {
    if (!selectedProperty || selectedKeyframeIndex === null) return
    removeKeyframe(selectedProperty, selectedKeyframeIndex)
    setSelectedKeyframeIndex(null)
  }, [selectedProperty, selectedKeyframeIndex, removeKeyframe, setSelectedKeyframeIndex])

  // Edit keyframe value
  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedProperty || selectedKeyframeIndex === null) return
      const val = parseFloat(e.target.value)
      if (!isNaN(val)) {
        updateKeyframeValue(selectedProperty, selectedKeyframeIndex, val)
      }
    },
    [selectedProperty, selectedKeyframeIndex, updateKeyframeValue],
  )

  return (
    <div className="keyframe-timeline">
      {/* Phase selector bar */}
      <div
        ref={phaseBarRef}
        className="keyframe-timeline__phase-bar"
        onPointerMove={handlePhasePointerMove}
        onPointerUp={handlePhasePointerUp}
        onPointerCancel={handlePhasePointerUp}
      >
        {visiblePhases.map((phase, i) => {
          const frames = editMode === 'highlight' ? 100
            : phase === 'enter' ? enterDurationFrames
            : phase === 'active' ? activeCycleDurationFrames
            : exitDurationFrames
          const widthPct = totalFrames > 0 ? (frames / totalFrames) * 100 : (100 / visiblePhases.length)
          const isActive = editMode === 'highlight' || selectedPhase === phase
          const setFrames = editMode === 'highlight' ? (() => {}) // duration is fixed at 100% scale
            : phase === 'enter' ? setEnterDurationFrames
            : phase === 'active' ? setActiveCycleDurationFrames
            : setExitDurationFrames
          return (
            <div key={phase} className="keyframe-timeline__phase-block-wrap" style={{ width: `${widthPct}%` }}>
              <button
                type="button"
                className={`keyframe-timeline__phase-block keyframe-timeline__phase-block--${phase}${isActive ? ' keyframe-timeline__phase-block--selected' : ''}`}
                onClick={() => setSelectedPhase(phase)}
              >
                <span className="keyframe-timeline__phase-label">{editMode === 'highlight' ? 'Highlight Enter' : PHASE_LABELS[phase]}</span>
                {editMode === 'highlight' ? (
                  <>
                    <FrameInput
                      value={highlightEnterPct}
                      onChange={(v) => setHighlightEnterPct(Math.max(1, Math.min(100, v)))}
                      label="Enter percentage of word duration"
                    />
                    <span className="keyframe-timeline__phase-unit">%</span>
                  </>
                ) : (
                  <>
                    <FrameInput
                      value={frames}
                      onChange={setFrames}
                      label={`${PHASE_LABELS[phase]} duration in frames`}
                    />
                    <span className="keyframe-timeline__phase-unit">f</span>
                    <span className="keyframe-timeline__phase-sec">({(frames / fps).toFixed(2)}s)</span>
                  </>
                )}
              </button>
              {/* Drag handle between enter/exit in enter-exit mode */}
              {editMode === 'enter-exit' && i < visiblePhases.length - 1 && (
                <div
                  className="keyframe-timeline__phase-handle"
                  onPointerDown={(e) => handlePhasePointerDown('enter-exit', e)}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Scrollable ruler + tracks container */}
      <div className="keyframe-timeline__scroll-area" ref={scrollContainerRef}>
        {/* Fixed label column + scrollable content */}
        <div className="keyframe-timeline__scroll-body">
          {/* Left labels column (fixed) */}
          <div className="keyframe-timeline__labels-col">
            <div className="keyframe-timeline__ruler-spacer" />
            {ALL_PROPERTIES.map((prop) => (
              <div
                key={prop}
                className={`keyframe-timeline__label-cell${selectedProperty === prop ? ' keyframe-timeline__label-cell--selected' : ''}`}
                onClick={() => {
                  setSelectedProperty(prop)
                  setSelectedKeyframeIndex(null)
                }}
              >
                {PROPERTY_LABELS[prop]}
              </div>
            ))}
          </div>

          {/* Scrollable tracks area */}
          <div className="keyframe-timeline__scrollable">
            <div className="keyframe-timeline__content" style={{ width: trackContentWidth }}>
              {/* Ruler — click to seek */}
              <div className="keyframe-timeline__ruler-track" onClick={handleRulerClick}>
                {rulerTicks.map((frame) => (
                  <span
                    key={frame}
                    className="keyframe-timeline__ruler-label"
                    style={{ left: frame * pxPerFrame }}
                  >
                    {editMode === 'highlight' ? `${frame}%` : frame}
                  </span>
                ))}
                {/* Playhead in ruler */}
                <div
                  className="keyframe-timeline__playhead"
                  style={{ left: playheadPx }}
                />
              </div>

              {/* Track rows */}
              <div className="keyframe-timeline__tracks">
                {/* Playhead line spanning all tracks */}
                <div
                  className="keyframe-timeline__playhead-line"
                  style={{ left: playheadPx }}
                />

                {ALL_PROPERTIES.map((prop) => {
                  const track = currentTracks.find((t) => t.property === prop)
                  return (
                    <KeyframeTrackRow
                      key={prop}
                      property={prop}
                      track={track}
                      phaseDurationFrames={phaseDurationFrames}
                      pxPerFrame={pxPerFrame}
                      trackContentWidth={trackContentWidth}
                      selectedKeyframeIndex={selectedProperty === prop ? selectedKeyframeIndex : null}
                      isSelected={selectedProperty === prop}
                      onSelectProperty={() => {
                        setSelectedProperty(prop)
                        setSelectedKeyframeIndex(null)
                      }}
                      onAddKeyframe={(time, value) => addKeyframe(prop, time, value)}
                      onRemoveKeyframe={(index) => {
                        removeKeyframe(prop, index)
                        if (selectedKeyframeIndex === index) {
                          setSelectedKeyframeIndex(null)
                        }
                      }}
                      onMoveKeyframe={(index, newTime) => updateKeyframeTime(prop, index, newTime)}
                      onSelectKeyframe={(index) => {
                        setSelectedProperty(prop)
                        setSelectedKeyframeIndex(index)
                      }}
                      onSetEasing={(segmentIndex, easing) => setTrackEasing(prop, segmentIndex, easing)}
                      onSeekToFrame={seekToPhaseFrame ?? undefined}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="keyframe-timeline__bottom-bar">
        {selectedKeyframe && selectedProperty ? (
          <span className="keyframe-timeline__bottom-label">
            {selectedProperty.toUpperCase()} at frame {Math.round(selectedKeyframe.time)}: {selectedKeyframe.value}
          </span>
        ) : (
          <span className="keyframe-timeline__bottom-hint">
            {selectedProperty
              ? 'Double-click track or click a diamond to edit'
              : 'Select a property row to begin'}
          </span>
        )}

        {/* FPS selector */}
        <div className="keyframe-timeline__fps-group">
          {FPS_OPTIONS.map((f) => (
            <button
              key={f}
              type="button"
              className={`keyframe-timeline__fps-btn${fps === f ? ' keyframe-timeline__fps-btn--active' : ''}`}
              onClick={() => setFps(f)}
            >
              {f}
            </button>
          ))}
          <span className="keyframe-timeline__fps-label">fps</span>
        </div>

        {/* Zoom controls */}
        <div className="keyframe-timeline__zoom-group">
          <button
            type="button"
            className="keyframe-timeline__zoom-btn"
            onClick={() => setPxPerFrame((p) => Math.max(MIN_PX_PER_FRAME, p * 0.75))}
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="keyframe-timeline__zoom-btn keyframe-timeline__zoom-btn--fit"
            onClick={handleZoomFit}
            title="Zoom to fit"
          >
            Fit
          </button>
          <button
            type="button"
            className="keyframe-timeline__zoom-btn"
            onClick={() => setPxPerFrame((p) => Math.min(MAX_PX_PER_FRAME, p * 1.33))}
            title="Zoom in"
          >
            +
          </button>
        </div>

        <div className="keyframe-timeline__bottom-actions">
          <button
            type="button"
            className="keyframe-timeline__add-btn"
            onClick={handleAddAtPlayhead}
            disabled={!selectedProperty}
            title={selectedProperty ? `Add keyframe at frame ${Math.round(playheadFrame)}` : 'Select a property first'}
          >
            Add KF
          </button>
          <button
            type="button"
            className="keyframe-timeline__delete-btn"
            onClick={handleDeleteSelected}
            disabled={selectedKeyframeIndex === null || !selectedProperty}
            title="Delete selected keyframe"
          >
            Delete KF
          </button>
        </div>
      </div>
    </div>
  )
}

const PROPERTY_LABELS: Record<KeyframeableProperty, string> = {
  x: 'X',
  y: 'Y',
  scale: 'Scale',
  rotation: 'Rot.',
  opacity: 'Opac.',
}

/** Generate ruler tick marks — adapt interval so labels don't overlap at current zoom. */
function computeRulerTicks(durationFrames: number, pxPerFrame: number): number[] {
  if (durationFrames <= 0) return [0]

  // Target ~50px between ticks minimum
  const minPxBetweenTicks = 50
  const rawInterval = Math.ceil(minPxBetweenTicks / pxPerFrame)

  // Snap interval to nice numbers: 1, 2, 5, 10, 15, 30, 60...
  const niceIntervals = [1, 2, 5, 10, 15, 30, 60, 120, 300]
  let interval = niceIntervals.find((n) => n >= rawInterval) ?? rawInterval

  const ticks: number[] = [0]
  for (let f = interval; f < durationFrames; f += interval) {
    ticks.push(f)
  }
  if (ticks[ticks.length - 1] !== durationFrames) {
    ticks.push(durationFrames)
  }
  return ticks
}
