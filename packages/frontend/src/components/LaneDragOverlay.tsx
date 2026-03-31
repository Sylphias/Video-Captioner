import { useCallback, useRef } from 'react'
import { useSubtitleStore } from '../store/subtitleStore.ts'
import './LaneDragOverlay.css'

interface LaneDragOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function LaneDragOverlay({ containerRef }: LaneDragOverlayProps) {
  const style = useSubtitleStore((s) => s.style)
  const laneCount = useSubtitleStore((s) => s.laneCount)
  const laneLocks = useSubtitleStore((s) => s.laneLocks)

  const draggingRef = useRef<{
    laneIndex: number
    startY: number
    startVerticalPosition: number
    startLaneGap: number
  } | null>(null)

  const getContainerHeight = useCallback((): number => {
    return containerRef.current?.offsetHeight ?? 1
  }, [containerRef])

  const handleMouseDown = useCallback((e: React.MouseEvent, laneIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    const currentStyle = useSubtitleStore.getState().style
    const currentLocks = useSubtitleStore.getState().laneLocks

    draggingRef.current = {
      laneIndex,
      startY: e.clientY,
      startVerticalPosition: currentStyle.verticalPosition,
      startLaneGap: currentStyle.laneGap,
    }

    const onMove = (moveE: MouseEvent) => {
      const drag = draggingRef.current
      if (!drag) return
      const containerH = getContainerHeight()
      const deltaPercent = ((moveE.clientY - drag.startY) / containerH) * 100

      if (drag.laneIndex === 0) {
        const allOthersLocked = Array.from({ length: useSubtitleStore.getState().laneCount })
          .every((_, i) => i === 0 || currentLocks[i])

        if (allOthersLocked || useSubtitleStore.getState().laneCount === 1) {
          const newPos = Math.min(95, Math.max(5, drag.startVerticalPosition + deltaPercent))
          const newGap = drag.startLaneGap + deltaPercent
          const clampedGap = Math.min(25, Math.max(1, newGap))
          useSubtitleStore.getState().setStyle({
            verticalPosition: Math.round(newPos),
            laneGap: Math.round(clampedGap),
          })
        } else {
          const newPos = Math.min(95, Math.max(5, drag.startVerticalPosition + deltaPercent))
          useSubtitleStore.getState().setStyle({ verticalPosition: Math.round(newPos) })
        }
      } else {
        const newGap = drag.startLaneGap - deltaPercent / drag.laneIndex
        const clamped = Math.min(25, Math.max(1, newGap))
        useSubtitleStore.getState().setStyle({ laneGap: Math.round(clamped) })
      }
    }

    const onUp = () => {
      draggingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [getContainerHeight])

  if (laneCount < 1) return null

  return (
    <div className="lane-drag-overlay" aria-hidden="true">
      {Array.from({ length: laneCount }).map((_, i) => {
        const vertPos = style.verticalPosition - i * style.laneGap
        const isLocked = laneLocks[i] ?? false

        return (
          <div
            key={i}
            className={`lane-drag-overlay__lane${isLocked ? ' lane-drag-overlay__lane--locked' : ''}`}
            style={{ top: `${vertPos}%` }}
            onMouseDown={(e) => handleMouseDown(e, i)}
          >
            <div className="lane-drag-overlay__handle">
              <span className="lane-drag-overlay__guide" />
              <span className="lane-drag-overlay__label">
                {isLocked ? '\u{1F512} ' : ''}Lane {i + 1}
              </span>
              <span className="lane-drag-overlay__guide" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
