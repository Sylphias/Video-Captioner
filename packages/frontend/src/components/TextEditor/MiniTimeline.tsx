import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SessionPhrase } from '../../store/subtitleStore.ts'
import {
  clampViewStart,
  zoomAnchoredViewStart,
  centeredViewStart,
  offscreenSide,
  isTypingTarget,
  JUMP_TO_PLAYHEAD_KEY,
} from '../../lib/timelineZoom.ts'
import { computeEdgeHandleZones } from '../../lib/edgeHandleZones.ts'
import './MiniTimeline.css'

const SPEAKER_COLORS = ['#4A90D9', '#E67E22', '#27AE60', '#9B59B6', '#E74C3C', '#1ABC9C', '#F39C12', '#95A5A6']

function getSpeakerColor(speakerId: string): string {
  const idx = parseInt(speakerId.replace('SPEAKER_', ''), 10) % 8
  return SPEAKER_COLORS[isNaN(idx) ? 0 : idx]
}

interface SpeakerLane {
  speakerId: string
  phrases: Array<{ phrase: SessionPhrase; phraseIndex: number }>
}

interface WaveformData {
  samples: number[]
  duration: number
}

interface MiniTimelineProps {
  phrases: SessionPhrase[]
  totalDuration: number
  currentTime: number
  activePhraseIndex: number | null
  speakerNames: Record<string, string>
  waveform?: WaveformData | null
  onSeek: (timeSec: number) => void
  onAdjustStart?: (phraseIndex: number, newStartSec: number) => void
  onAdjustEnd?: (phraseIndex: number, newEndSec: number) => void
  onShiftPhrase?: (phraseIndex: number, deltaSec: number) => void
  onReassignSpeaker?: (phraseIndex: number, speakerId: string) => void
  onHoverPhrase?: (phraseIndex: number | null) => void
  onEditSpeaker?: (speakerId: string) => void
}

function formatPlayheadTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`
}

const MIN_VISIBLE_LANES = 3
const LANE_HEIGHT = 28
const WAVEFORM_HEIGHT = 48
const MAX_ZOOM = 20

export function MiniTimeline({
  phrases,
  totalDuration,
  currentTime,
  activePhraseIndex,
  speakerNames,
  waveform,
  onSeek,
  onAdjustStart,
  onAdjustEnd,
  onShiftPhrase,
  onReassignSpeaker,
  onHoverPhrase,
  onEditSpeaker,
}: MiniTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const waveformRowRef = useRef<HTMLDivElement>(null)
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef<{ type: 'start' | 'end'; phraseIndex: number } | null>(null)

  // Phrase shift-drag state (drag to move whole phrase)
  const shiftRef = useRef<{ phraseIndex: number; startX: number; startTimeSec: number } | null>(null)
  const [shiftDrag, setShiftDrag] = useState<{ phraseIndex: number; offsetPct: number } | null>(null)

  // Cross-lane drag state (HTML5 drag-and-drop for speaker reassignment)
  const [dragOverLane, setDragOverLane] = useState<string | null>(null)

  // ── Zoom state ──
  const [zoomLevel, setZoomLevel] = useState(1) // 1 = show all, >1 = zoomed in
  const [viewStart, setViewStart] = useState(0) // start of visible window in seconds

  const visibleDuration = totalDuration / zoomLevel
  const viewEnd = Math.min(totalDuration, viewStart + visibleDuration)
  // Re-clamp viewStart if viewEnd hit totalDuration
  const clampedViewStart = Math.max(0, viewEnd - visibleDuration)

  // Track manual pan to suppress auto-follow temporarily
  const lastManualPanRef = useRef(0)

  // Auto-follow playhead during playback (suppressed briefly after manual pan)
  useEffect(() => {
    if (zoomLevel <= 1) return
    if (Date.now() - lastManualPanRef.current < 3000) return // 3s cooldown after manual pan
    if (currentTime < clampedViewStart || currentTime > viewEnd) {
      setViewStart(Math.max(0, Math.min(totalDuration - visibleDuration, currentTime - visibleDuration / 2)))
    }
  }, [currentTime, zoomLevel, clampedViewStart, viewEnd, visibleDuration, totalDuration])

  // Keep refs in sync so wheel handler always sees latest values. applyZoom /
  // the pan handler also write these synchronously so consecutive wheel ticks
  // that arrive before a re-render compose from the latest window.
  const zoomRef = useRef(zoomLevel)
  const visibleDurationRef = useRef(visibleDuration)
  const totalDurationRef = useRef(totalDuration)
  const viewStartRef = useRef(clampedViewStart)
  const currentTimeRef = useRef(currentTime)
  zoomRef.current = zoomLevel
  visibleDurationRef.current = visibleDuration
  totalDurationRef.current = totalDuration
  viewStartRef.current = clampedViewStart
  currentTimeRef.current = currentTime

  /**
   * Single zoom entry point (Ctrl/Cmd+Wheel and the -/+ buttons). Anchors on
   * the playhead: a visible playhead keeps its fractional on-screen position;
   * an off-screen playhead gets the zoomed window centered on it.
   */
  const applyZoom = useCallback((computeNextZoom: (currentZoom: number) => number) => {
    const td = totalDurationRef.current
    if (td <= 0) return
    const oldZoom = zoomRef.current
    const newZoom = Math.min(MAX_ZOOM, Math.max(1, computeNextZoom(oldZoom)))
    const newVisible = td / newZoom
    const newViewStart = zoomAnchoredViewStart({
      viewStart: viewStartRef.current,
      visibleDuration: td / oldZoom,
      newVisibleDuration: newVisible,
      totalDuration: td,
      playheadTime: currentTimeRef.current,
    })
    zoomRef.current = newZoom
    visibleDurationRef.current = newVisible
    viewStartRef.current = newViewStart
    setZoomLevel(newZoom)
    setViewStart(newViewStart)
  }, [])

  const applyZoomRef = useRef(applyZoom)
  applyZoomRef.current = applyZoom

  // Center the visible window on the playhead (jump button, shortcut, and the
  // off-screen indicator). No-op at zoom 1 where everything is visible.
  const centerOnPlayhead = useCallback(() => {
    const td = totalDurationRef.current
    if (zoomRef.current <= 1 || td <= 0) return
    const next = centeredViewStart(currentTimeRef.current, visibleDurationRef.current, td)
    viewStartRef.current = next
    setViewStart(next)
  }, [])

  // Jump-to-playhead shortcut. MiniTimeline is only mounted on the Text stage,
  // so this never double-fires with TimingEditor's identical shortcut. Ignored
  // while typing (the transcript editor is contentEditable) and for modified
  // combos (Ctrl/Cmd+C copy etc.).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== JUMP_TO_PLAYHEAD_KEY && e.key !== JUMP_TO_PLAYHEAD_KEY.toUpperCase()) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      centerOnPlayhead()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [centerOnPlayhead])

  // Ctrl+Wheel zoom + pan
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()
        const factor = e.deltaY > 0 ? 0.85 : 1.18
        applyZoomRef.current(z => z * factor)
      } else if (zoomRef.current > 1) {
        // Pan when zoomed — stop parent scroll container from intercepting
        e.preventDefault()
        e.stopPropagation()
        lastManualPanRef.current = Date.now()
        const vd = visibleDurationRef.current
        const td = totalDurationRef.current
        const panSec = (e.deltaY / 300) * vd
        const next = clampViewStart(viewStartRef.current + panSec, vd, td)
        viewStartRef.current = next
        setViewStart(next)
      }
    }
    // Use capture phase so we intercept before the parent scroll container
    el.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => el.removeEventListener('wheel', handleWheel, { capture: true })
  }, []) // stable — reads from refs

  // Reset viewStart when zoom goes back to 1
  useEffect(() => {
    if (zoomLevel <= 1) setViewStart(0)
  }, [zoomLevel])

  // Helper: convert time to percentage in the visible window
  const timeToPct = useCallback((t: number) => {
    return ((t - clampedViewStart) / visibleDuration) * 100
  }, [clampedViewStart, visibleDuration])

  // Find the nearest lane-area ancestor for accurate time calculations
  const findLaneArea = useCallback((target: HTMLElement): HTMLElement | null => {
    let el: HTMLElement | null = target
    while (el && !el.classList.contains('mini-timeline__lane-area')) {
      el = el.parentElement
    }
    return el
  }, [])

  const handleBlockMouseDown = useCallback((e: React.MouseEvent, phraseIndex: number, phraseStartSec: number) => {
    if (e.button !== 0) return
    // Don't interfere with edge-handle drags
    if ((e.target as HTMLElement).classList.contains('mini-timeline__handle')) return
    e.stopPropagation()

    const laneArea = findLaneArea(e.target as HTMLElement)
    const startX = e.clientX
    const startY = e.clientY
    let decided = false

    const onMove = (moveE: MouseEvent) => {
      const dx = moveE.clientX - startX
      const dy = moveE.clientY - startY

      // Dead zone — wait for movement to determine intent
      if (!decided && Math.abs(dx) < 4 && Math.abs(dy) < 4) return

      if (!decided) {
        decided = true
        // Vertical dominant → let HTML5 drag handle cross-lane reassignment
        if (Math.abs(dy) > Math.abs(dx)) {
          cleanup()
          return
        }
        // Horizontal dominant → start shift drag
        shiftRef.current = { phraseIndex, startX, startTimeSec: phraseStartSec }
        document.body.style.cursor = 'grabbing'
      }

      if (!shiftRef.current) return
      const el = laneArea
      if (!el) return
      const pxWidth = el.getBoundingClientRect().width
      const offsetPct = (dx / pxWidth) * 100
      setShiftDrag({ phraseIndex: shiftRef.current.phraseIndex, offsetPct })
    }

    const cleanup = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }

    const onUp = (upE: MouseEvent) => {
      cleanup()

      if (shiftRef.current && onShiftPhrase) {
        const el = laneArea
        if (el) {
          const dx = upE.clientX - shiftRef.current.startX
          const pxWidth = el.getBoundingClientRect().width
          const deltaSec = (dx / pxWidth) * visibleDuration
          if (Math.abs(deltaSec) > 0.01) {
            onShiftPhrase(shiftRef.current.phraseIndex, deltaSec)
          }
        }
      }
      shiftRef.current = null
      setShiftDrag(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [visibleDuration, onShiftPhrase, findLaneArea])

  // HTML5 drag handlers for cross-lane speaker reassignment
  const handleDragStart = useCallback((e: React.DragEvent, phraseIndex: number) => {
    if (shiftRef.current) { e.preventDefault(); return }
    e.dataTransfer.setData('text/plain', String(phraseIndex))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleLaneDragOver = useCallback((e: React.DragEvent, speakerId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverLane(speakerId)
  }, [])

  const handleLaneDragLeave = useCallback(() => {
    setDragOverLane(null)
  }, [])

  const handleLaneDrop = useCallback((e: React.DragEvent, speakerId: string) => {
    e.preventDefault()
    setDragOverLane(null)
    const phraseIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(phraseIndex) && onReassignSpeaker) {
      onReassignSpeaker(phraseIndex, speakerId)
    }
  }, [onReassignSpeaker])

  // Hovered block (reveals its edge-handle bars, which are lane-level siblings
  // and so can't use a `.block:hover .handle` selector).
  const [hoveredBlock, setHoveredBlock] = useState<number | null>(null)

  // Track waveform row width for responsive canvas (matches lane-area width)
  const [canvasWidth, setCanvasWidth] = useState(300)
  const waveformHasData = !!(waveform && waveform.samples.length > 0)
  useEffect(() => {
    const el = waveformRowRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setCanvasWidth(Math.floor(entry.contentRect.width))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [waveformHasData])

  // Draw waveform (only the visible portion when zoomed)
  useEffect(() => {
    const canvas = waveformCanvasRef.current
    if (!canvas || !waveform || waveform.samples.length === 0 || totalDuration <= 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const centerY = h / 2
    const sampleCount = waveform.samples.length

    // Compute visible sample range
    const startSample = Math.floor((clampedViewStart / totalDuration) * sampleCount)
    const endSample = Math.ceil((viewEnd / totalDuration) * sampleCount)
    const visibleSamples = Math.max(1, endSample - startSample)
    const sampleWidth = w / visibleSamples

    const playheadX = totalDuration > 0 ? timeToPct(currentTime) / 100 * w : 0

    for (let si = 0; si < visibleSamples; si++) {
      const idx = startSample + si
      if (idx < 0 || idx >= sampleCount) continue
      const x = (si + 0.5) * sampleWidth
      const amplitude = waveform.samples[idx]
      const halfHeight = amplitude * centerY * 0.9

      ctx.strokeStyle = x <= playheadX
        ? 'rgba(0, 230, 150, 0.6)'
        : 'rgba(0, 230, 150, 0.2)'
      ctx.lineWidth = Math.max(1, sampleWidth)

      ctx.beginPath()
      ctx.moveTo(x, centerY - halfHeight)
      ctx.lineTo(x, centerY + halfHeight)
      ctx.stroke()
    }

    // Playhead line
    if (playheadX >= 0 && playheadX <= w) {
      ctx.strokeStyle = 'rgba(0, 230, 150, 1)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, h)
      ctx.stroke()
    }
  }, [waveform, currentTime, totalDuration, canvasWidth, clampedViewStart, viewEnd, visibleDuration, timeToPct])

  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(clampedViewStart + ratio * visibleDuration)
  }, [clampedViewStart, visibleDuration, onSeek])

  const lanes = useMemo((): SpeakerLane[] => {
    const laneMap = new Map<string, SpeakerLane>()
    for (const speakerId of Object.keys(speakerNames)) {
      laneMap.set(speakerId, { speakerId, phrases: [] })
    }
    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[i]
      const speakerId = phrase.dominantSpeaker ?? '_unknown'
      if (!laneMap.has(speakerId)) {
        laneMap.set(speakerId, { speakerId, phrases: [] })
      }
      laneMap.get(speakerId)!.phrases.push({ phrase, phraseIndex: i })
    }
    return [...laneMap.values()].filter(l => l.phrases.length > 0 || l.speakerId.startsWith('CUSTOM_'))
  }, [phrases, speakerNames])

  // Measured lane-area pixel width, needed to lay edge-handle hit zones out in
  // pixels (blocks themselves are positioned in percent). Observes the always-
  // mounted container and re-reads a lane area, so lane remounts and the
  // lane-scrollbar appearing/disappearing are both picked up.
  const [laneAreaWidth, setLaneAreaWidth] = useState(0)
  const laneCountForMeasure = lanes.length
  const isRendered = totalDuration > 0
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const measure = () => {
      const area = container.querySelector<HTMLElement>('.mini-timeline__lane-area')
      setLaneAreaWidth(area ? area.getBoundingClientRect().width : 0)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [laneCountForMeasure, isRendered])

  const pxToTime = useCallback((clientX: number, targetEl?: HTMLElement): number => {
    const el = targetEl ?? containerRef.current
    if (!el || visibleDuration <= 0) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return clampedViewStart + ratio * visibleDuration
  }, [clampedViewStart, visibleDuration])

  const handleEdgeDrag = useCallback((
    e: React.MouseEvent,
    type: 'start' | 'end',
    phraseIndex: number,
  ) => {
    e.stopPropagation()
    e.preventDefault()
    draggingRef.current = { type, phraseIndex }
    const laneArea = findLaneArea(e.target as HTMLElement)

    const onMove = (moveE: MouseEvent) => {
      const t = pxToTime(moveE.clientX, laneArea ?? undefined)
      if (type === 'start' && onAdjustStart) onAdjustStart(phraseIndex, t)
      else if (type === 'end' && onAdjustEnd) onAdjustEnd(phraseIndex, t)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      setTimeout(() => { draggingRef.current = null }, 10)
    }

    document.body.style.cursor = 'ew-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [pxToTime, findLaneArea, onAdjustStart, onAdjustEnd])

  if (totalDuration <= 0) return null

  const playheadPct = timeToPct(currentTime)
  // Derived from props/state already driving renders — no extra render loop.
  const playheadOffscreen = zoomLevel > 1 ? offscreenSide(currentTime, clampedViewStart, visibleDuration) : null
  const needsScroll = lanes.length > MIN_VISIBLE_LANES
  const maxHeight = MIN_VISIBLE_LANES * LANE_HEIGHT

  // Pad with empty lanes if fewer than MIN_VISIBLE_LANES
  const emptyLaneCount = Math.max(0, MIN_VISIBLE_LANES - lanes.length)

  return (
    <div className="mini-timeline" ref={containerRef}>
      {/* Off-screen playhead indicator: pinned to the lane-area edge, click to jump */}
      {playheadOffscreen && (
        <button
          type="button"
          className={`mini-timeline__offscreen-playhead mini-timeline__offscreen-playhead--${playheadOffscreen}`}
          onClick={centerOnPlayhead}
          title={`Playhead is off-screen — click to jump to it (${JUMP_TO_PLAYHEAD_KEY.toUpperCase()})`}
          aria-label="Jump to playhead"
        >
          {playheadOffscreen === 'left' && <span aria-hidden="true">◀</span>}
          <span>{formatPlayheadTime(currentTime)}</span>
          {playheadOffscreen === 'right' && <span aria-hidden="true">▶</span>}
        </button>
      )}
      {/* Waveform row — click here to seek */}
      {waveform && waveform.samples.length > 0 && (
        <div
          ref={waveformRowRef}
          className="mini-timeline__waveform-row"
          style={{ height: WAVEFORM_HEIGHT }}
          onClick={handleWaveformClick}
        >
          <canvas
            ref={waveformCanvasRef}
            className="mini-timeline__waveform-canvas"
            width={canvasWidth}
            height={WAVEFORM_HEIGHT}
            style={{ display: 'block', width: '100%', height: WAVEFORM_HEIGHT }}
          />
          <div
            className="mini-timeline__playhead"
            style={{ left: `${playheadPct}%` }}
          />
        </div>
      )}

      {/* Speaker lanes */}
      <div
        className="mini-timeline__scroll"
        style={needsScroll ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        {lanes.map((lane) => {
          const color = getSpeakerColor(lane.speakerId)
          const label = speakerNames[lane.speakerId] ?? lane.speakerId
          // Per-phrase geometry (percent of the lane area), shared by blocks and edge handles.
          const laneGeometry = lane.phrases
            .filter(({ phrase }) => phrase.words.length > 0)
            .map(({ phrase, phraseIndex }) => {
              const start = phrase.words[0].start
              const end = phrase.words[phrase.words.length - 1].end
              const leftPct = timeToPct(start)
              const realWidthPct = ((end - start) / visibleDuration) * 100
              const isDragging = shiftDrag?.phraseIndex === phraseIndex
              const visualLeft = isDragging && shiftDrag ? leftPct + shiftDrag.offsetPct : leftPct
              return { phrase, phraseIndex, start, visualLeft, realWidthPct }
            })

          return (
            <div
              key={lane.speakerId}
              className={`mini-timeline__lane${dragOverLane === lane.speakerId ? ' mini-timeline__lane--drag-over' : ''}`}
              style={{ height: LANE_HEIGHT }}
              onDragOver={(e) => handleLaneDragOver(e, lane.speakerId)}
              onDragLeave={handleLaneDragLeave}
              onDrop={(e) => handleLaneDrop(e, lane.speakerId)}
            >
              <span
                className="mini-timeline__lane-label"
                style={{ color, cursor: onEditSpeaker ? 'pointer' : undefined, pointerEvents: onEditSpeaker ? 'auto' : undefined }}
                title={`${label} — click to edit style`}
                onClick={(e) => { e.stopPropagation(); onEditSpeaker?.(lane.speakerId) }}
              >
                {label}
              </span>

              <div className="mini-timeline__lane-area">
                {/* Playhead line within lane area */}
                <div
                  className="mini-timeline__playhead mini-timeline__playhead--lanes"
                  style={{ left: `${playheadPct}%` }}
                />

                {laneGeometry.map(({ phrase, phraseIndex, start, visualLeft, realWidthPct }) => {
                  const isActive = phraseIndex === activePhraseIndex
                  const isDragging = shiftDrag?.phraseIndex === phraseIndex

                  return (
                    <div
                      key={phraseIndex}
                      className={`mini-timeline__block${isActive ? ' mini-timeline__block--active' : ''}${isDragging ? ' mini-timeline__block--dragging' : ''}`}
                      style={{
                        left: `${visualLeft}%`,
                        width: `${Math.max(realWidthPct, 0.3)}%`,
                        backgroundColor: color,
                        cursor: onShiftPhrase ? 'grab' : undefined,
                      }}
                      title={phrase.words.map(w => w.word).join(' ').slice(0, 50)}
                      onMouseDown={(e) => handleBlockMouseDown(e, phraseIndex, start)}
                      onMouseEnter={() => { setHoveredBlock(phraseIndex); onHoverPhrase?.(phraseIndex) }}
                      onMouseLeave={() => { setHoveredBlock(null); onHoverPhrase?.(null) }}
                      draggable={!!onReassignSpeaker}
                      onDragStart={(e) => handleDragStart(e, phraseIndex)}
                    />
                  )
                })}
                {/* Edge-drag grab zones: lane-level siblings above the blocks,
                    ~12px straddling each edge and split at the seam between
                    adjacent phrases (lib/edgeHandleZones.ts). Needs the measured
                    lane-area width to lay out in pixels. */}
                {laneAreaWidth > 0 && (() => {
                  const zones = computeEdgeHandleZones(
                    laneGeometry.map((g) => {
                      const startPx = (g.visualLeft / 100) * laneAreaWidth
                      return { start: startPx, end: startPx + (g.realWidthPct / 100) * laneAreaWidth }
                    }),
                  )
                  return laneGeometry.flatMap((g, i) => {
                    const startPx = (g.visualLeft / 100) * laneAreaWidth
                    const endPx = startPx + (g.realWidthPct / 100) * laneAreaWidth
                    return (['start', 'end'] as const).map((edge) => {
                      const zone = edge === 'start' ? zones[i].start : zones[i].end
                      // Skip handles entirely outside the visible window
                      if (zone.right < 0 || zone.left > laneAreaWidth) return null
                      const edgeX = edge === 'start' ? startPx : endPx
                      return (
                        <div
                          key={`${g.phraseIndex}-${edge}`}
                          className={`mini-timeline__handle mini-timeline__handle--${edge === 'start' ? 'left' : 'right'}${hoveredBlock === g.phraseIndex ? ' mini-timeline__handle--block-hover' : ''}`}
                          style={{
                            left: zone.left,
                            width: Math.max(0, zone.right - zone.left),
                            '--edge-x': `${edgeX - zone.left}px`,
                          } as React.CSSProperties}
                          onMouseDown={(e) => handleEdgeDrag(e, edge, g.phraseIndex)}
                          title={edge === 'start' ? 'Drag to adjust phrase start' : 'Drag to adjust phrase end'}
                        />
                      )
                    })
                  })
                })()}
              </div>
            </div>
          )
        })}

        {/* Empty lane placeholders */}
        {Array.from({ length: emptyLaneCount }).map((_, i) => (
          <div key={`empty-${i}`} className="mini-timeline__lane mini-timeline__lane--empty" style={{ height: LANE_HEIGHT }} />
        ))}
      </div>
      <div className="mini-timeline__hints">
        <span>Ctrl+Scroll to zoom</span>
        <span>Scroll to pan</span>
        {zoomLevel > 1 && <span>{Math.round(zoomLevel)}x</span>}
        <div className="mini-timeline__zoom-group">
          <button
            className="mini-timeline__zoom-btn mini-timeline__zoom-btn--playhead"
            onClick={centerOnPlayhead}
            title={`Jump to playhead (${JUMP_TO_PLAYHEAD_KEY.toUpperCase()})`}
            aria-label="Jump to playhead"
          >⌖</button>
          <button
            className="mini-timeline__zoom-btn"
            onClick={() => applyZoom(z => z * 0.75)}
            title="Zoom out"
          >-</button>
          <button
            className="mini-timeline__zoom-btn"
            onClick={() => { setZoomLevel(1); setViewStart(0) }}
            title="Fit all"
          >Fit</button>
          <button
            className="mini-timeline__zoom-btn"
            onClick={() => applyZoom(z => z * 1.33)}
            title="Zoom in"
          >+</button>
        </div>
      </div>
    </div>
  )
}
