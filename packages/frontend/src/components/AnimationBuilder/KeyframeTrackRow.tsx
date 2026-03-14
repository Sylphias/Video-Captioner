import { useRef, useState, useCallback, useEffect } from 'react'
import type { KeyframeableProperty, KeyframeTrack, KeyframeEasing } from '@eigen/shared-types'
import { EasingPicker } from './EasingPicker'
import './KeyframeTrackRow.css'

interface KeyframeTrackRowProps {
  property: KeyframeableProperty
  track: KeyframeTrack | undefined
  playheadProgress: number
  selectedKeyframeIndex: number | null
  isSelected: boolean
  onSelectProperty: () => void
  onAddKeyframe: (time: number, value: number) => void
  onRemoveKeyframe: (index: number) => void
  onMoveKeyframe: (index: number, newTime: number) => void
  onSelectKeyframe: (index: number | null) => void
  onSetEasing: (segmentIndex: number, easing: KeyframeEasing) => void
}

// Label mapping for each property
const PROPERTY_LABELS: Record<KeyframeableProperty, string> = {
  x: 'X',
  y: 'Y',
  scale: 'Scale',
  rotation: 'Rot.',
  opacity: 'Opac.',
}

// Default values when adding a new keyframe for each property
const DEFAULT_VALUES: Record<KeyframeableProperty, number> = {
  x: 50,
  y: 75,
  scale: 1,
  rotation: 0,
  opacity: 1,
}

// Popover state for EasingPicker
interface EasingPopover {
  segmentIndex: number
  x: number
  y: number
}

export function KeyframeTrackRow({
  property,
  track,
  playheadProgress,
  selectedKeyframeIndex,
  isSelected,
  onSelectProperty,
  onAddKeyframe,
  onRemoveKeyframe,
  onMoveKeyframe,
  onSelectKeyframe,
  onSetEasing,
}: KeyframeTrackRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [easingPopover, setEasingPopover] = useState<EasingPopover | null>(null)
  const [contextMenu, setContextMenu] = useState<{ index: number; x: number; y: number } | null>(null)
  const easingPopoverRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const keyframes = track?.keyframes ?? []
  const easings = track?.easings ?? []

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

  // Handle keyboard delete on selected keyframe
  useEffect(() => {
    if (!isSelected) return
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKeyframeIndex !== null) {
        onRemoveKeyframe(selectedKeyframeIndex)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSelected, selectedKeyframeIndex, onRemoveKeyframe])

  // Double-click on track area to add keyframe
  const handleTrackDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const time = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      onAddKeyframe(time, DEFAULT_VALUES[property])
      onSelectProperty()
    },
    [property, onAddKeyframe, onSelectProperty],
  )

  // Drag logic for diamonds using pointer capture
  const handleDiamondPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, index: number) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      setDraggingIndex(index)
      onSelectKeyframe(index)
      onSelectProperty()
    },
    [onSelectKeyframe, onSelectProperty],
  )

  const handleDiamondPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, index: number) => {
      if (draggingIndex !== index) return
      const trackEl = trackRef.current
      if (!trackEl) return
      const rect = trackEl.getBoundingClientRect()
      const newTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      onMoveKeyframe(index, newTime)
    },
    [draggingIndex, onMoveKeyframe],
  )

  const handleDiamondPointerUp = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>, _index: number) => {
      setDraggingIndex(null)
    },
    [],
  )

  // Click on diamond to select
  const handleDiamondClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation()
      onSelectKeyframe(index)
      onSelectProperty()
    },
    [onSelectKeyframe, onSelectProperty],
  )

  // Right-click on diamond for context menu
  const handleDiamondContextMenu = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({ index, x: e.clientX, y: e.clientY })
    },
    [],
  )

  // Click on segment between keyframes to open EasingPicker
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
        // Show easing for the segment before this keyframe (index - 1) or after (index)
        const segIdx = Math.max(0, contextMenu.index - 1)
        if (easings.length > 0 && segIdx < easings.length) {
          setEasingPopover({ segmentIndex: segIdx, x: e.clientX, y: e.clientY })
        }
        setContextMenu(null)
      }
    },
    [contextMenu, easings.length],
  )

  const label = PROPERTY_LABELS[property]

  return (
    <div
      className={[
        'keyframe-track-row',
        isSelected ? 'keyframe-track-row--selected' : '',
      ].join(' ').trim()}
      role="row"
    >
      {/* Property label */}
      <div
        className="keyframe-track-row__label"
        onClick={onSelectProperty}
        role="rowheader"
      >
        {label}
      </div>

      {/* Track area */}
      <div
        ref={trackRef}
        className="keyframe-track-row__track"
        onDoubleClick={handleTrackDoubleClick}
        onClick={() => onSelectProperty()}
        role="presentation"
      >
        {/* Grid lines at 25%, 50%, 75% */}
        <div className="keyframe-track-row__gridline" style={{ left: '25%' }} />
        <div className="keyframe-track-row__gridline" style={{ left: '50%' }} />
        <div className="keyframe-track-row__gridline" style={{ left: '75%' }} />

        {/* Segment lines between consecutive keyframes */}
        {keyframes.map((kf, i) => {
          if (i === keyframes.length - 1) return null
          const nextKf = keyframes[i + 1]
          const left = kf.time * 100
          const width = (nextKf.time - kf.time) * 100
          return (
            <div
              key={`seg-${i}`}
              className="keyframe-track-row__segment"
              style={{ left: `${left}%`, width: `${width}%` }}
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
              className={[
                'keyframe-track-row__diamond',
                isKfSelected
                  ? 'keyframe-track-row__diamond--selected'
                  : 'keyframe-track-row__diamond--default',
              ].join(' ')}
              style={{ left: `${kf.time * 100}%` }}
              onPointerDown={(e) => handleDiamondPointerDown(e, i)}
              onPointerMove={(e) => handleDiamondPointerMove(e, i)}
              onPointerUp={(e) => handleDiamondPointerUp(e, i)}
              onClick={(e) => handleDiamondClick(e, i)}
              onContextMenu={(e) => handleDiamondContextMenu(e, i)}
              role="button"
              aria-label={`Keyframe at ${Math.round(kf.time * 100)}%`}
            />
          )
        })}
      </div>

      {/* Context menu (right-click on diamond) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="keyframe-track-row__context-menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            type="button"
            className="keyframe-track-row__context-menu-item"
            onClick={handleContextMenuDelete}
          >
            Delete keyframe
          </button>
          {easings.length > 0 && (
            <button
              type="button"
              className="keyframe-track-row__context-menu-item"
              onClick={handleContextMenuSetEasing}
            >
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
