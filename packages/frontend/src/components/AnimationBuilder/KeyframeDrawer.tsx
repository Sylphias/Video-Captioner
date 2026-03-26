import { useState, useEffect, useCallback } from 'react'
import type { KeyframeableProperty } from '@eigen/shared-types'
import { useBuilderStore } from './useBuilderStore'
import './KeyframeDrawer.css'

const ALL_PROPERTIES: KeyframeableProperty[] = ['x', 'y', 'scale', 'rotation', 'opacity']

const PROPERTY_LABELS: Record<KeyframeableProperty, string> = {
  x: 'X Position',
  y: 'Y Position',
  scale: 'Scale',
  rotation: 'Rotation',
  opacity: 'Opacity',
}

const PROPERTY_UNITS: Record<KeyframeableProperty, string> = {
  x: '%',
  y: '%',
  scale: 'x',
  rotation: 'deg',
  opacity: '',
}

const PROPERTY_STEPS: Record<KeyframeableProperty, number> = {
  x: 1,
  y: 1,
  scale: 0.01,
  rotation: 1,
  opacity: 0.01,
}

/** Commit-on-blur number input for property values. */
function ValueInput({ value, onChange, step, unit, label }: {
  value: number
  onChange: (v: number) => void
  step: number
  unit: string
  label: string
}) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  const commit = () => {
    const v = parseFloat(draft)
    if (!isNaN(v)) {
      onChange(v)
    } else {
      setDraft(String(value))
    }
  }

  return (
    <div className="kf-drawer__value-wrap">
      <input
        type="text"
        inputMode="decimal"
        className="kf-drawer__value-input"
        value={draft}
        onFocus={(e) => { setFocused(true); e.target.select() }}
        onBlur={() => { setFocused(false); commit() }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={label}
      />
      {unit && <span className="kf-drawer__value-unit">{unit}</span>}
    </div>
  )
}

/** Commit-on-blur frame input. */
function FrameInput({ value, onChange, max, label }: {
  value: number
  onChange: (v: number) => void
  max: number
  label: string
}) {
  const [draft, setDraft] = useState(String(Math.round(value)))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(Math.round(value)))
  }, [value, focused])

  const commit = () => {
    const v = parseInt(draft, 10)
    if (!isNaN(v) && v >= 0 && v <= max) {
      onChange(v)
    } else {
      setDraft(String(Math.round(value)))
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className="kf-drawer__frame-input"
      value={draft}
      onFocus={(e) => { setFocused(true); e.target.select() }}
      onBlur={() => { setFocused(false); commit() }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      onChange={(e) => setDraft(e.target.value)}
      aria-label={label}
    />
  )
}

export function KeyframeDrawer() {
  const selectedProperty = useBuilderStore((s) => s.selectedProperty)
  const selectedKeyframeIndex = useBuilderStore((s) => s.selectedKeyframeIndex)
  const selectedPhase = useBuilderStore((s) => s.selectedPhase)
  const enterTracks = useBuilderStore((s) => s.enterTracks)
  const activeTracks = useBuilderStore((s) => s.activeTracks)
  const exitTracks = useBuilderStore((s) => s.exitTracks)
  const enterDurationFrames = useBuilderStore((s) => s.enterDurationFrames)
  const activeCycleDurationFrames = useBuilderStore((s) => s.activeCycleDurationFrames)
  const exitDurationFrames = useBuilderStore((s) => s.exitDurationFrames)
  const updateKeyframeValue = useBuilderStore((s) => s.updateKeyframeValue)
  const updateKeyframeTime = useBuilderStore((s) => s.updateKeyframeTime)
  const removeKeyframe = useBuilderStore((s) => s.removeKeyframe)
  const setSelectedKeyframeIndex = useBuilderStore((s) => s.setSelectedKeyframeIndex)
  const setSelectedProperty = useBuilderStore((s) => s.setSelectedProperty)

  const editMode = useBuilderStore((s) => s.editMode)
  const highlightEnterTracks = useBuilderStore((s) => s.highlightEnterTracks)

  const currentTracks = editMode === 'highlight' ? highlightEnterTracks
    : selectedPhase === 'enter' ? enterTracks
    : selectedPhase === 'active' ? activeTracks
    : exitTracks
  const phaseDuration = editMode === 'highlight' ? 100
    : selectedPhase === 'enter' ? enterDurationFrames
    : selectedPhase === 'active' ? activeCycleDurationFrames
    : exitDurationFrames

  // Find the selected keyframe
  const selectedTrack = selectedProperty
    ? currentTracks.find((t) => t.property === selectedProperty)
    : undefined
  const selectedKeyframe =
    selectedTrack && selectedKeyframeIndex !== null
      ? selectedTrack.keyframes[selectedKeyframeIndex]
      : undefined

  const isOpen = selectedKeyframe !== undefined && selectedProperty !== null && selectedKeyframeIndex !== null

  const handleClose = useCallback(() => {
    setSelectedKeyframeIndex(null)
  }, [setSelectedKeyframeIndex])

  const handleDelete = useCallback(() => {
    if (selectedProperty && selectedKeyframeIndex !== null) {
      removeKeyframe(selectedProperty, selectedKeyframeIndex)
      setSelectedKeyframeIndex(null)
    }
  }, [selectedProperty, selectedKeyframeIndex, removeKeyframe, setSelectedKeyframeIndex])

  return (
    <>
      <div className={`kf-drawer${isOpen ? ' kf-drawer--open' : ''}`}>
        {/* Header */}
        <div className="kf-drawer__header">
          <h3 className="kf-drawer__title">
            {selectedProperty ? PROPERTY_LABELS[selectedProperty] : 'Keyframe'}
          </h3>
          <button type="button" className="kf-drawer__close-btn" onClick={handleClose} aria-label="Close">
            &times;
          </button>
        </div>

        {isOpen && selectedProperty && selectedKeyframe && selectedKeyframeIndex !== null && (
          <div className="kf-drawer__body">
            {/* Frame position */}
            <div className="kf-drawer__field">
              <label className="kf-drawer__field-label">Frame</label>
              <div className="kf-drawer__field-row">
                <FrameInput
                  value={selectedKeyframe.time}
                  onChange={(v) => updateKeyframeTime(selectedProperty, selectedKeyframeIndex, v)}
                  max={phaseDuration}
                  label="Keyframe frame"
                />
                <span className="kf-drawer__field-hint">/ {phaseDuration}</span>
              </div>
            </div>

            {/* Value */}
            <div className="kf-drawer__field">
              <label className="kf-drawer__field-label">Value</label>
              <ValueInput
                value={selectedKeyframe.value}
                onChange={(v) => updateKeyframeValue(selectedProperty, selectedKeyframeIndex, v)}
                step={PROPERTY_STEPS[selectedProperty]}
                unit={PROPERTY_UNITS[selectedProperty]}
                label={`${PROPERTY_LABELS[selectedProperty]} value`}
              />
            </div>

            {/* Keyframe navigation */}
            <div className="kf-drawer__nav">
              <button
                type="button"
                className="kf-drawer__nav-btn"
                disabled={selectedKeyframeIndex <= 0}
                onClick={() => setSelectedKeyframeIndex(selectedKeyframeIndex - 1)}
              >
                Prev
              </button>
              <span className="kf-drawer__nav-info">
                {selectedKeyframeIndex + 1} / {selectedTrack?.keyframes.length ?? 0}
              </span>
              <button
                type="button"
                className="kf-drawer__nav-btn"
                disabled={!selectedTrack || selectedKeyframeIndex >= selectedTrack.keyframes.length - 1}
                onClick={() => setSelectedKeyframeIndex(selectedKeyframeIndex + 1)}
              >
                Next
              </button>
            </div>

            {/* Delete */}
            <button type="button" className="kf-drawer__delete-btn" onClick={handleDelete}>
              Delete Keyframe
            </button>
          </div>
        )}
      </div>
    </>
  )
}
