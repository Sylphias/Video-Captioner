import { useCallback } from 'react'
import type { KeyframeableProperty } from '@eigen/shared-types'
import { useBuilderStore } from './useBuilderStore'
import { KeyframeTrackRow } from './KeyframeTrackRow'
import './KeyframeTimeline.css'

const ALL_PROPERTIES: KeyframeableProperty[] = ['x', 'y', 'scale', 'rotation', 'opacity']

// Default values for each property when adding a keyframe via the "Add KF" button
const DEFAULT_VALUES: Record<KeyframeableProperty, number> = {
  x: 50,
  y: 75,
  scale: 1,
  rotation: 0,
  opacity: 1,
}

// Ruler tick positions
const RULER_TICKS = [0, 25, 50, 75, 100]

export function KeyframeTimeline() {
  const keyframeTracks = useBuilderStore((s) => s.keyframeTracks)
  const playheadProgress = useBuilderStore((s) => s.playheadProgress)
  const selectedProperty = useBuilderStore((s) => s.selectedProperty)
  const selectedKeyframeIndex = useBuilderStore((s) => s.selectedKeyframeIndex)
  const setSelectedProperty = useBuilderStore((s) => s.setSelectedProperty)
  const setSelectedKeyframeIndex = useBuilderStore((s) => s.setSelectedKeyframeIndex)
  const addKeyframe = useBuilderStore((s) => s.addKeyframe)
  const removeKeyframe = useBuilderStore((s) => s.removeKeyframe)
  const updateKeyframeTime = useBuilderStore((s) => s.updateKeyframeTime)
  const updateKeyframeValue = useBuilderStore((s) => s.updateKeyframeValue)
  const setTrackEasing = useBuilderStore((s) => s.setTrackEasing)

  // Get the selected keyframe's track and keyframe object
  const selectedTrack = selectedProperty
    ? keyframeTracks.find((t) => t.property === selectedProperty)
    : undefined

  const selectedKeyframe =
    selectedTrack && selectedKeyframeIndex !== null
      ? selectedTrack.keyframes[selectedKeyframeIndex]
      : undefined

  // Handle adding a keyframe at the current playhead position for the selected property
  const handleAddAtPlayhead = useCallback(() => {
    if (!selectedProperty) return
    addKeyframe(selectedProperty, playheadProgress, DEFAULT_VALUES[selectedProperty])
  }, [selectedProperty, playheadProgress, addKeyframe])

  // Handle deleting the selected keyframe
  const handleDeleteSelected = useCallback(() => {
    if (!selectedProperty || selectedKeyframeIndex === null) return
    removeKeyframe(selectedProperty, selectedKeyframeIndex)
    setSelectedKeyframeIndex(null)
  }, [selectedProperty, selectedKeyframeIndex, removeKeyframe, setSelectedKeyframeIndex])

  // Handle editing the selected keyframe's value via the input
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
      {/* Time ruler */}
      <div className="keyframe-timeline__ruler">
        <div className="keyframe-timeline__ruler-spacer" />
        <div className="keyframe-timeline__ruler-track">
          {RULER_TICKS.map((pct) => (
            <span
              key={pct}
              className="keyframe-timeline__ruler-label"
              style={{ left: `${pct}%` }}
            >
              {pct}%
            </span>
          ))}
          {/* Playhead line in ruler */}
          <div
            className="keyframe-timeline__playhead"
            style={{ left: `${playheadProgress * 100}%` }}
          />
        </div>
      </div>

      {/* All 5 property track rows — plus a relative container for the playhead line spanning all rows */}
      <div className="keyframe-timeline__tracks">
        {/* Playhead line spanning all tracks.
            The label column is 60px wide, so we position the line at 60px + progress * track-area.
            We use a flex row overlay: a 60px spacer + the actual line inside a flex-1 container. */}
        <div className="keyframe-timeline__playhead-row" aria-hidden="true">
          <div className="keyframe-timeline__playhead-spacer" />
          <div className="keyframe-timeline__playhead-track">
            <div
              className="keyframe-timeline__playhead-line"
              style={{ left: `${playheadProgress * 100}%` }}
            />
          </div>
        </div>

        {ALL_PROPERTIES.map((prop) => {
          const track = keyframeTracks.find((t) => t.property === prop)
          return (
            <KeyframeTrackRow
              key={prop}
              property={prop}
              track={track}
              playheadProgress={playheadProgress}
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
            />
          )
        })}
      </div>

      {/* Bottom bar: selected keyframe info + Add/Delete buttons */}
      <div className="keyframe-timeline__bottom-bar">
        {selectedKeyframe && selectedProperty ? (
          <>
            <span className="keyframe-timeline__bottom-label">
              {selectedProperty.toUpperCase()} at {Math.round(selectedKeyframe.time * 100)}%:
            </span>
            <input
              type="number"
              className="keyframe-timeline__value-input"
              value={selectedKeyframe.value}
              onChange={handleValueChange}
              step={selectedProperty === 'opacity' || selectedProperty === 'scale' ? 0.01 : 1}
              aria-label={`${selectedProperty} value`}
            />
          </>
        ) : (
          <span className="keyframe-timeline__bottom-hint">
            {selectedProperty
              ? 'Double-click track or use Add button'
              : 'Select a property row to begin'}
          </span>
        )}

        <div className="keyframe-timeline__bottom-actions">
          <button
            type="button"
            className="keyframe-timeline__add-btn"
            onClick={handleAddAtPlayhead}
            disabled={!selectedProperty}
            title={selectedProperty ? `Add keyframe at ${Math.round(playheadProgress * 100)}%` : 'Select a property first'}
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
