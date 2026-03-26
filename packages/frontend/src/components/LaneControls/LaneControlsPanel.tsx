import { useCallback } from 'react'
import type { SpeakerLane, LaneLayout } from '@eigen/shared-types'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import { useLanePresets } from '../../hooks/useLanePresets.ts'
import { getSpeakerColor } from '../../utils/speakerColors.ts'
import './LaneControlsPanel.css'

interface LaneControlsPanelProps {
  speakerLanes: Record<string, SpeakerLane>
  speakerNames: Record<string, string>
  overlapGap: number
  maxVisibleRows: number
}

/** Returns true if speakerId is within 10% of any other speaker */
function hasProximityWarning(
  speakerId: string,
  speakerLanes: Record<string, SpeakerLane>
): boolean {
  const myPos = speakerLanes[speakerId]?.verticalPosition
  if (myPos === undefined) return false
  for (const [otherId, other] of Object.entries(speakerLanes)) {
    if (otherId === speakerId) continue
    if (Math.abs(other.verticalPosition - myPos) < 10) return true
  }
  return false
}

export function LaneControlsPanel({
  speakerLanes,
  speakerNames,
  overlapGap,
  maxVisibleRows,
}: LaneControlsPanelProps) {
  const setSpeakerLane = useSubtitleStore((s) => s.setSpeakerLane)
  const setOverlapGap = useSubtitleStore((s) => s.setOverlapGap)
  const setMaxVisibleRows = useSubtitleStore((s) => s.setMaxVisibleRows)
  const loadLaneLayout = useSubtitleStore((s) => s.loadLaneLayout)

  const { presets, loading: presetsLoading, createPreset, deletePreset } = useLanePresets()

  const handlePositionChange = useCallback((speakerId: string, value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num)) {
      setSpeakerLane(speakerId, Math.min(95, Math.max(5, num)))
    }
  }, [setSpeakerLane])

  const handleSavePreset = useCallback(async () => {
    const name = window.prompt('Preset name:')
    if (!name?.trim()) return

    const layout: LaneLayout = {
      speakerLanes,
      overlapGap,
      maxVisibleRows,
    }
    try {
      await createPreset(name.trim(), layout)
    } catch (err) {
      console.error('[LaneControlsPanel] save preset failed:', err)
      alert('Failed to save preset')
    }
  }, [speakerLanes, overlapGap, maxVisibleRows, createPreset])

  const handleLoadPreset = useCallback((presetId: string) => {
    if (!presetId) return
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return
    loadLaneLayout(preset.layout)
  }, [presets, loadLaneLayout])

  const handleDeletePreset = useCallback(async (presetId: string) => {
    if (!presetId) return
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return
    if (!window.confirm(`Delete preset "${preset.name}"?`)) return
    try {
      await deletePreset(presetId)
    } catch (err) {
      console.error('[LaneControlsPanel] delete preset failed:', err)
      alert('Failed to delete preset')
    }
  }, [presets, deletePreset])

  const speakerIds = Object.keys(speakerLanes)

  return (
    <div className="lane-controls-panel">
      <div className="lane-controls-panel__header">Lanes</div>

      {/* Per-speaker rows */}
      <div className="lane-controls-panel__speakers">
        {speakerIds.map((speakerId) => {
          const lane = speakerLanes[speakerId]
          const color = getSpeakerColor(speakerId)
          const displayName = speakerNames[speakerId] ?? speakerId
          const warn = hasProximityWarning(speakerId, speakerLanes)

          return (
            <div key={speakerId} className="lane-controls-panel__speaker-row">
              <span
                className="lane-controls-panel__color-bar"
                style={{ background: color }}
              />
              <span className="lane-controls-panel__speaker-name" title={displayName}>
                {displayName}
              </span>
              <div className="lane-controls-panel__input-group">
                <input
                  type="number"
                  className="lane-controls-panel__pos-input"
                  min={5}
                  max={95}
                  step={1}
                  value={Math.round(lane.verticalPosition)}
                  onChange={(e) => handlePositionChange(speakerId, e.target.value)}
                />
                <span className="lane-controls-panel__unit">%</span>
                {warn && (
                  <span
                    className="lane-controls-panel__warn"
                    title="Speakers are within 10% of each other"
                  >
                    ⚠
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {speakerIds.length === 0 && (
          <p className="lane-controls-panel__empty">No speakers detected</p>
        )}
      </div>

      {/* Global controls */}
      <div className="lane-controls-panel__section">
        <div className="lane-controls-panel__section-title">Global</div>
        <div className="lane-controls-panel__control-row">
          <label className="lane-controls-panel__label">Overlap Gap</label>
          <input
            type="number"
            className="lane-controls-panel__num-input"
            min={1}
            max={30}
            step={1}
            value={overlapGap}
            onChange={(e) => setOverlapGap(Number(e.target.value))}
          />
          <span className="lane-controls-panel__unit">%</span>
        </div>
        <div className="lane-controls-panel__control-row">
          <label className="lane-controls-panel__label">Max Rows</label>
          <input
            type="number"
            className="lane-controls-panel__num-input"
            min={1}
            max={10}
            step={1}
            value={maxVisibleRows}
            onChange={(e) => setMaxVisibleRows(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Preset section */}
      <div className="lane-controls-panel__section">
        <div className="lane-controls-panel__section-title">Presets</div>
        {!presetsLoading && presets.length > 0 && (
          <select
            className="lane-controls-panel__preset-select"
            defaultValue=""
            onChange={(e) => handleLoadPreset(e.target.value)}
          >
            <option value="" disabled>Load preset...</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {!presetsLoading && presets.length === 0 && (
          <p className="lane-controls-panel__empty">No presets saved</p>
        )}
        <div className="lane-controls-panel__preset-actions">
          <button
            className="lane-controls-panel__btn"
            type="button"
            onClick={handleSavePreset}
          >
            Save
          </button>
          <button
            className="lane-controls-panel__btn lane-controls-panel__btn--danger"
            type="button"
            onClick={() => {
              // Pick from list if multiple presets
              if (presets.length === 0) {
                alert('No presets to delete')
                return
              }
              if (presets.length === 1) {
                void handleDeletePreset(presets[0].id)
                return
              }
              // Show a simple picker using prompt
              const options = presets.map((p, i) => `${i + 1}. ${p.name}`).join('\n')
              const input = window.prompt(`Choose preset to delete:\n${options}`)
              if (!input) return
              const idx = parseInt(input, 10) - 1
              if (idx >= 0 && idx < presets.length) {
                void handleDeletePreset(presets[idx].id)
              }
            }}
            disabled={presets.length === 0}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
