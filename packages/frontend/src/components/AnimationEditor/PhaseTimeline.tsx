import { useRef, useCallback } from 'react'
import './PhaseTimeline.css'

type Phase = 'enter' | 'active' | 'exit'

interface PhaseTimelineProps {
  enterDuration: number     // seconds
  activeDuration: number    // seconds (derived: total - enter - exit; display only)
  exitDuration: number      // seconds
  totalDuration: number     // total timeline duration (e.g. 3.0s default for editing)
  selectedPhase: Phase
  onSelectPhase: (phase: Phase) => void
  onEnterDurationChange: (sec: number) => void
  onExitDurationChange: (sec: number) => void
}

const MIN_PHASE_SEC = 0.05

function formatSec(sec: number): string {
  return sec.toFixed(2) + 's'
}

export function PhaseTimeline({
  enterDuration,
  activeDuration,
  exitDuration,
  totalDuration,
  selectedPhase,
  onSelectPhase,
  onEnterDurationChange,
  onExitDurationChange,
}: PhaseTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Pixel-to-seconds ratio based on container width
  const getPixelsPerSec = useCallback(() => {
    if (!containerRef.current) return 1
    return containerRef.current.getBoundingClientRect().width / totalDuration
  }, [totalDuration])

  // Drag for enter/active boundary handle (changes enter duration)
  const handleEnterDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startEnterDuration = enterDuration

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX
      const pps = getPixelsPerSec()
      const deltaSec = dx / pps
      const newEnter = startEnterDuration + deltaSec
      // Clamp: min 0.05s, max totalDuration - exitDuration - 0.1s
      const clamped = Math.max(MIN_PHASE_SEC, Math.min(totalDuration - exitDuration - 0.1, newEnter))
      onEnterDurationChange(Math.round(clamped * 100) / 100)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [enterDuration, exitDuration, totalDuration, getPixelsPerSec, onEnterDurationChange])

  // Drag for active/exit boundary handle (changes exit duration)
  const handleExitDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startExitDuration = exitDuration

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX
      const pps = getPixelsPerSec()
      const deltaSec = dx / pps
      // Dragging right increases exit, dragging left decreases it
      const newExit = startExitDuration - deltaSec
      // Clamp: min 0.05s, max totalDuration - enterDuration - 0.1s
      const clamped = Math.max(MIN_PHASE_SEC, Math.min(totalDuration - enterDuration - 0.1, newExit))
      onExitDurationChange(Math.round(clamped * 100) / 100)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [exitDuration, enterDuration, totalDuration, getPixelsPerSec, onExitDurationChange])

  const enterPct = (enterDuration / totalDuration) * 100
  const exitPct = (exitDuration / totalDuration) * 100
  const activePct = Math.max(0, 100 - enterPct - exitPct)

  return (
    <div className="phase-timeline">
      <div className="phase-timeline__label-row">
        <span className="phase-timeline__section-label">Phase Timeline</span>
      </div>
      <div ref={containerRef} className="phase-timeline__bar">
        {/* Enter block */}
        <div
          className={[
            'phase-timeline__block',
            'phase-timeline__block--enter',
            selectedPhase === 'enter' ? 'phase-timeline__block--selected' : '',
          ].join(' ').trim()}
          style={{ flexBasis: `${enterPct}%` }}
          onClick={() => onSelectPhase('enter')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectPhase('enter') }}
        >
          <span className="phase-timeline__block-label">Enter</span>
          <span className="phase-timeline__block-dur">{formatSec(enterDuration)}</span>
        </div>

        {/* Enter/Active drag handle */}
        <div
          className="phase-timeline__handle"
          onMouseDown={handleEnterDragStart}
          role="separator"
          aria-label="Drag to resize enter phase"
        />

        {/* Active block */}
        <div
          className={[
            'phase-timeline__block',
            'phase-timeline__block--active',
            selectedPhase === 'active' ? 'phase-timeline__block--selected' : '',
          ].join(' ').trim()}
          style={{ flexBasis: `${activePct}%` }}
          onClick={() => onSelectPhase('active')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectPhase('active') }}
        >
          <span className="phase-timeline__block-label">Hold</span>
          <span className="phase-timeline__block-dur">{formatSec(activeDuration)}</span>
        </div>

        {/* Active/Exit drag handle */}
        <div
          className="phase-timeline__handle"
          onMouseDown={handleExitDragStart}
          role="separator"
          aria-label="Drag to resize exit phase"
        />

        {/* Exit block */}
        <div
          className={[
            'phase-timeline__block',
            'phase-timeline__block--exit',
            selectedPhase === 'exit' ? 'phase-timeline__block--selected' : '',
          ].join(' ').trim()}
          style={{ flexBasis: `${exitPct}%` }}
          onClick={() => onSelectPhase('exit')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectPhase('exit') }}
        >
          <span className="phase-timeline__block-label">Exit</span>
          <span className="phase-timeline__block-dur">{formatSec(exitDuration)}</span>
        </div>
      </div>
    </div>
  )
}
