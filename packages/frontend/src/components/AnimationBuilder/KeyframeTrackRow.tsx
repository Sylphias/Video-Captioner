import { useRef, useState, useCallback, useEffect } from 'react'
import type { KeyframeableProperty, KeyframeTrack, KeyframeEasing } from '@eigen/shared-types'
import { EasingPicker } from './EasingPicker'
import './KeyframeTrackRow.css'

interface KeyframeTrackRowProps {
  property: KeyframeableProperty
  track: KeyframeTrack | undefined
  phaseDurationFrames: number
  pxPerFrame: number
  trackContentWidth: number
  selectedKeyframeIndex: number | null
  isSelected: boolean
  onSelectProperty: () => void
  onAddKeyframe: (time: number, value: number) => void
  onRemoveKeyframe: (index: number) => void
  onMoveKeyframe: (index: number, newTime: number) => void
  onSelectKeyframe: (index: number | null) => void
  onSetEasing: (segmentIndex: number, easing: KeyframeEasing) => void
  onSeekToFrame?: (frame: number) => void
}

const DEFAULT_VALUES: Record<KeyframeableProperty, number> = {
  x: 50,
  y: 75,
  scale: 1,
  rotation: 0,
  opacity: 1,
}

interface EasingPopover {
  segmentIndex: number
  x: number
  y: number
}

export function KeyframeTrackRow({
  property,
  track,
  phaseDurationFrames,
  pxPerFrame,
  trackContentWidth,
  selectedKeyframeIndex,
  isSelected,
  onSelectProperty,
  onAddKeyframe,
  onRemoveKeyframe,
  onMoveKeyframe,
  onSelectKeyframe,
  onSetEasing,
  onSeekToFrame,
}: KeyframeTrackRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [easingPopover, setEasingPopover] = useState<EasingPopover | null>(null)
  const [contextMenu, setContextMenu] = useState<{ index: number; x: number; y: number } | null>(null)
  const easingPopoverRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const keyframes = track?.keyframes ?? []
  const easings = track?.easings ?? []

  // Convert frame number to pixel position
  const frameToPx = useCallback(
    (frame: number) => frame * pxPerFrame,
    [pxPerFrame],
  )

  // Convert a pixel X position (relative to trackRef) to a frame number
  const pixelToFrame = useCallback(
    (clientX: number): number => {
      const trackEl = trackRef.current
      if (!trackEl || phaseDurationFrames <= 0) return 0
      const rect = trackEl.getBoundingClientRect()
      const px = clientX - rect.left
      const frame = Math.round(px / pxPerFrame)
      return Math.max(0, Math.min(phaseDurationFrames, frame))
    },
    [phaseDurationFrames, pxPerFrame],
  )

  // Close popover/context menu on outside click
  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      if (
        easingPopover &&
        easingPopoverRef.current &&
        !easingPopoverRef.current.contains(e.target as Node)
      ) {
        setEasingPopover(null)
      }
      if (
        contextMenu &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [easingPopover, contextMenu])

  // Handle keyboard delete on selected keyframe (Delete key only, not Backspace)
  useEffect(() => {
    if (!isSelected) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Delete' && selectedKeyframeIndex !== null) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        onRemoveKeyframe(selectedKeyframeIndex)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSelected, selectedKeyframeIndex, onRemoveKeyframe])

  // Double-click on track area to add keyframe
  const handleTrackDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const frame = pixelToFrame(e.clientX)
      onAddKeyframe(frame, DEFAULT_VALUES[property])
      onSelectProperty()
    },
    [property, pixelToFrame, onAddKeyframe, onSelectProperty],
  )

  // Drag logic for diamonds
  const handleDiamondPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, index: number) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      setDraggingIndex(index)
      onSelectKeyframe(index)
    },
    [onSelectKeyframe],
  )

  const handleDiamondPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, index: number) => {
      if (draggingIndex !== index) return
      const newFrame = pixelToFrame(e.clientX)
      onMoveKeyframe(index, newFrame)
    },
    [draggingIndex, pixelToFrame, onMoveKeyframe],
  )

  const handleDiamondPointerUp = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>, _index: number) => {
      setDraggingIndex(null)
    },
    [],
  )

  const handleDiamondClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation()
      onSelectKeyframe(index)
    },
    [onSelectKeyframe],
  )

  const handleDiamondContextMenu = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({ index, x: e.clientX, y: e.clientY })
    },
    [],
  )

  const handleSegmentClick = useCallback(
    (e: React.MouseEvent, segmentIndex: number) => {
      e.stopPropagation()
      setEasingPopover({ segmentIndex, x: e.clientX, y: e.clientY })
    },
    [],
  )

  const handleEasingChange = useCallback(
    (easing: KeyframeEasing) => {
      if (easingPopover !== null) {
        onSetEasing(easingPopover.segmentIndex, easing)
      }
    },
    [easingPopover, onSetEasing],
  )

  const handleContextMenuDelete = useCallback(() => {
    if (contextMenu !== null) {
      onRemoveKeyframe(contextMenu.index)
      setContextMenu(null)
    }
  }, [contextMenu, onRemoveKeyframe])

  const handleContextMenuSetEasing = useCallback(
    (e: React.MouseEvent) => {
      if (contextMenu !== null) {
        const segIdx = Math.max(0, contextMenu.index - 1)
        if (easings.length > 0 && segIdx < easings.length) {
          setEasingPopover({ segmentIndex: segIdx, x: e.clientX, y: e.clientY })
        }
        setContextMenu(null)
      }
    },
    [contextMenu, easings.length],
  )

  // Compute gridline positions (every N frames depending on zoom)
  const gridlines = computeGridlinePx(phaseDurationFrames, pxPerFrame, trackContentWidth)

  return (
    <div
      className={`keyframe-track-row${isSelected ? ' keyframe-track-row--selected' : ''}`}
      role="row"
    >
      <div
        ref={trackRef}
        className="keyframe-track-row__track"
        style={{ width: trackContentWidth }}
        onDoubleClick={handleTrackDoubleClick}
        onClick={(e) => {
          onSelectProperty()
          if (onSeekToFrame) {
            const frame = pixelToFrame(e.clientX)
            onSeekToFrame(frame)
          }
        }}
        role="presentation"
      >
        {/* Grid lines */}
        {gridlines.map((px) => (
          <div key={px} className="keyframe-track-row__gridline" style={{ left: px }} />
        ))}

        {/* Segment lines between consecutive keyframes */}
        {keyframes.map((kf, i) => {
          if (i === keyframes.length - 1) return null
          const nextKf = keyframes[i + 1]
          const leftPx = frameToPx(kf.time)
          const widthPx = frameToPx(nextKf.time) - leftPx
          return (
            <div
              key={`seg-${i}`}
              className="keyframe-track-row__segment"
              style={{ left: leftPx, width: widthPx }}
              onClick={(e) => handleSegmentClick(e, i)}
              title={`Easing: ${easings[i]?.type ?? 'ease-in-out'}`}
            />
          )
        })}

        {/* Keyframe diamonds */}
        {keyframes.map((kf, i) => {
          const isKfSelected = isSelected && selectedKeyframeIndex === i
          return (
            <div
              key={`kf-${i}`}
              className={`keyframe-track-row__diamond${isKfSelected ? ' keyframe-track-row__diamond--selected' : ' keyframe-track-row__diamond--default'}`}
              style={{ left: frameToPx(kf.time) }}
              onPointerDown={(e) => handleDiamondPointerDown(e, i)}
              onPointerMove={(e) => handleDiamondPointerMove(e, i)}
              onPointerUp={(e) => handleDiamondPointerUp(e, i)}
              onClick={(e) => handleDiamondClick(e, i)}
              onContextMenu={(e) => handleDiamondContextMenu(e, i)}
              role="button"
              aria-label={`Keyframe at frame ${Math.round(kf.time)}`}
            />
          )
        })}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="keyframe-track-row__context-menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
        >
          <button type="button" className="keyframe-track-row__context-menu-item" onClick={handleContextMenuDelete}>
            Delete keyframe
          </button>
          {easings.length > 0 && (
            <button type="button" className="keyframe-track-row__context-menu-item" onClick={handleContextMenuSetEasing}>
              Set easing...
            </button>
          )}
        </div>
      )}

      {/* EasingPicker popover */}
      {easingPopover !== null && (
        <div
          ref={easingPopoverRef}
          className="keyframe-track-row__easing-popover"
          style={{ position: 'fixed', top: easingPopover.y + 8, left: easingPopover.x }}
        >
          <EasingPicker
            value={easings[easingPopover.segmentIndex] ?? { type: 'ease-in-out' }}
            onChange={handleEasingChange}
            label={`Segment ${easingPopover.segmentIndex + 1} easing`}
          />
        </div>
      )}
    </div>
  )
}

/** Compute gridline pixel positions — one per frame or coarser based on zoom. */
function computeGridlinePx(durationFrames: number, pxPerFrame: number, _contentWidth: number): number[] {
  if (durationFrames <= 0) return []

  // Place gridlines every N frames so they're spaced ~40px apart minimum
  const minPxBetween = 40
  const rawInterval = Math.ceil(minPxBetween / pxPerFrame)
  const niceIntervals = [1, 2, 5, 10, 15, 30, 60]
  const interval = niceIntervals.find((n) => n >= rawInterval) ?? rawInterval

  const lines: number[] = []
  for (let f = interval; f < durationFrames; f += interval) {
    lines.push(f * pxPerFrame)
  }
  return lines
}
