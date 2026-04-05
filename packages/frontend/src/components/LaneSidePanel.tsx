import { useState } from 'react'
import { LaneConfigPanel } from './TimingEditor/LaneConfigPanel.tsx'
import { useSubtitleStore } from '../store/subtitleStore.ts'
import './LaneSidePanel.css'

interface LaneSidePanelProps {
  numSpeakers: number | undefined
  setNumSpeakers: (n: number | undefined) => void
  onDetectSpeakers: () => void
  detectDisabled: boolean
  detectLabel: string
  showLaneGuides: boolean
  onToggleLaneGuides: () => void
}

export function LaneSidePanel({
  numSpeakers,
  setNumSpeakers,
  onDetectSpeakers,
  detectDisabled,
  detectLabel,
  showLaneGuides,
  onToggleLaneGuides,
}: LaneSidePanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const additionalSpeakerCount = useSubtitleStore((s) => s.additionalSpeakerCount)
  const setAdditionalSpeakerCount = useSubtitleStore((s) => s.setAdditionalSpeakerCount)

  return (
    <div className={`lane-side-panel${collapsed ? ' lane-side-panel--collapsed' : ''}`}>
      <button
        type="button"
        className="lane-side-panel__toggle"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>Lanes</span>
        <span className="lane-side-panel__toggle-arrow">{collapsed ? '\u25B6' : '\u25C0'}</span>
      </button>

      <div className="lane-side-panel__content">
        {/* Speaker detection */}
        <div>
          <div className="lane-side-panel__section-title">Speakers</div>
          <div className="lane-side-panel__speaker-row">
            <label className="lane-side-panel__speaker-label">
              Count
              <input
                type="number"
                className="lane-side-panel__speaker-input"
                min={1}
                max={20}
                placeholder="Auto"
                value={numSpeakers ?? ''}
                onChange={(e) => setNumSpeakers(e.target.value ? Number(e.target.value) : undefined)}
              />
            </label>
            <label className="lane-side-panel__speaker-label">
              Extra
              <input
                type="number"
                className="lane-side-panel__speaker-input"
                min={0}
                max={10}
                value={additionalSpeakerCount}
                onChange={(e) => setAdditionalSpeakerCount(Number(e.target.value) || 0)}
              />
            </label>
          </div>
          <button
            type="button"
            className="lane-side-panel__detect-btn"
            onClick={onDetectSpeakers}
            disabled={detectDisabled}
          >
            {detectLabel}
          </button>
        </div>

        {/* Lane guides toggle */}
        <label className="lane-side-panel__checkbox-label">
          <input
            type="checkbox"
            checked={showLaneGuides}
            onChange={onToggleLaneGuides}
            className="lane-side-panel__checkbox"
          />
          Show lane guides
        </label>

        {/* Lane configuration */}
        <LaneConfigPanel />
      </div>
    </div>
  )
}
