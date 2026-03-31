import { useSubtitleStore } from '../../store/subtitleStore.ts'
import './LaneConfigPanel.css'

export function LaneConfigPanel() {
  const style = useSubtitleStore((s) => s.style)
  const setStyle = useSubtitleStore((s) => s.setStyle)
  const laneCount = useSubtitleStore((s) => s.laneCount)
  const setLaneCount = useSubtitleStore((s) => s.setLaneCount)
  const laneLocks = useSubtitleStore((s) => s.laneLocks)
  const phraseLaneOverrides = useSubtitleStore((s) => s.phraseLaneOverrides)
  const clearAllLaneOverrides = useSubtitleStore((s) => s.clearAllLaneOverrides)

  const hasOverrides = Object.keys(phraseLaneOverrides).length > 0

  const toggleLaneLock = (laneIndex: number) => {
    const current = laneLocks[laneIndex] ?? false
    useSubtitleStore.setState({
      laneLocks: { ...laneLocks, [laneIndex]: !current },
    })
  }

  return (
    <div className="lane-config">
      <div className="lane-config__header">
        <span className="lane-config__title">Lanes</span>
        <div className="lane-config__header-actions">
          {hasOverrides && (
            <button
              type="button"
              className="lane-config__clear-btn"
              onClick={clearAllLaneOverrides}
              title="Clear all phrase lane overrides"
            >
              Clear overrides
            </button>
          )}
        </div>
      </div>

      <div className="lane-config__lanes">
        {Array.from({ length: laneCount }).map((_, i) => {
          const vertPos = Math.round(style.verticalPosition - i * style.laneGap)
          const isLocked = laneLocks[i] ?? false
          return (
            <div key={i} className="lane-config__lane-row">
              <button
                type="button"
                className={`lane-config__lock-btn${isLocked ? ' lane-config__lock-btn--locked' : ''}`}
                onClick={() => toggleLaneLock(i)}
                title={isLocked ? 'Unlock lane' : 'Lock lane position'}
              >
                {isLocked ? '\u{1F512}' : '\u{1F513}'}
              </button>
              <span className="lane-config__lane-label">Lane {i + 1}</span>
              <span className="lane-config__lane-pos">{vertPos}%</span>
            </div>
          )
        })}
      </div>

      <div className="lane-config__lane-actions">
        <button
          type="button"
          className="lane-config__add-btn"
          onClick={() => setLaneCount(laneCount + 1)}
          title="Add another lane"
        >
          + Add Lane
        </button>
        {laneCount > 1 && (
          <button
            type="button"
            className="lane-config__remove-btn"
            onClick={() => setLaneCount(laneCount - 1)}
            title="Remove last lane"
          >
            - Remove
          </button>
        )}
      </div>

      {/* Lane gap slider */}
      <div className="lane-config__gap-control">
        <label className="lane-config__gap-label">
          Lane gap
          <span className="lane-config__gap-value">{style.laneGap}%</span>
        </label>
        <input
          type="range"
          className="lane-config__gap-slider"
          min={0}
          max={25}
          step={1}
          value={style.laneGap}
          onChange={(e) => setStyle({ laneGap: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}
