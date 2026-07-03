import { useState, useRef, useCallback, useEffect } from 'react'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import { useWaveform } from '../../hooks/useWaveform.ts'
import { findAdjacentSameSpeakerPhrase } from '../../lib/grouping.ts'
import { WaveformCanvas } from './WaveformCanvas.tsx'
import type { SessionPhrase } from '../../store/subtitleStore.ts'
import type { DiarizeState } from '../../hooks/useDiarize.ts'
import './TimingEditor.css'

interface TimingEditorProps {
  seekToTime: (timeSec: number) => void
  getCurrentTime?: (() => number) | null
  jobId: string
  diarizeState: DiarizeState
  onEditSpeaker?: (speakerId: string) => void
  onEditPhrase?: (phraseIndex: number) => void
  /** Set by the parent (e.g. phrase panel prev/next nav) to select + center a phrase
   * without requiring a direct click inside TimingEditor's own timeline. */
  focusSignal?: { phraseIndex: number } | null
}

const DEFAULT_PPS = 100
const MIN_PPS = 20
const MAX_PPS = 500
const LANE_HEIGHT = 44
const RULER_HEIGHT = 24
// Mirrors the MIN_DURATION clamp inside subtitleStore.setPhraseTiming so the
// edge-drag live preview matches what the store will accept on commit.
const MIN_PHRASE_DURATION = 0.05

interface SpeakerLane {
  speakerId: string
  phrases: Array<{ phrase: SessionPhrase; phraseIndex: number }>
}

/** Group phrases by dominant speaker into dedicated lanes. */
function buildSpeakerLanes(phrases: SessionPhrase[], speakerNames: Record<string, string>): SpeakerLane[] {
  const laneMap = new Map<string, SpeakerLane>()

  // Maintain order from speakerNames (deterministic)
  for (const sid of Object.keys(speakerNames)) {
    laneMap.set(sid, { speakerId: sid, phrases: [] })
  }

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i]
    if (phrase.words.length === 0) continue
    const speaker = phrase.dominantSpeaker ?? 'unknown'
    if (!laneMap.has(speaker)) {
      laneMap.set(speaker, { speakerId: speaker, phrases: [] })
    }
    laneMap.get(speaker)!.phrases.push({ phrase, phraseIndex: i })
  }

  return Array.from(laneMap.values()).filter(
    (lane) => lane.phrases.length > 0 || speakerNames[lane.speakerId]
  )
}

/** Format seconds as mm:ss for the time ruler. */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatTimePrecise(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(2).padStart(5, '0')}`
}

/** Get speaker color index (0-7) from a speaker ID. */
function getSpeakerColorIndex(speakerId: string): number {
  const idx = parseInt(speakerId.replace('SPEAKER_', ''), 10) % 8
  return isNaN(idx) ? 0 : idx
}

export function TimingEditor({
  seekToTime,
  getCurrentTime,
  jobId,
  diarizeState,
  onEditSpeaker,
  onEditPhrase,
  focusSignal,
}: TimingEditorProps) {
  const session = useSubtitleStore((s) => s.session)
  const speakerNames = useSubtitleStore((s) => s.speakerNames)
  const globalLingerDuration = useSubtitleStore((s) => s.style.lingerDuration ?? 1.0)
  const {
    splitPhrase,
    mergePhrase,
    setWordTransition,
    updatePhraseText,
    setPhraseLinger,
    renameSpeaker,
    reassignPhraseSpeaker,
    deleteSpeaker,
    deletePhrase,
    addPhraseAtTime,
    addWord,
    shiftPhrase,
    setPhraseLane,
    setPhraseHighlightDisabled,
    setPhraseTiming,
  } = useSubtitleStore()

  const { waveform } = useWaveform(jobId)

  const [selectedPhraseIndex, setSelectedPhraseIndex] = useState<number | null>(null)
  const [editingPhraseIndex, setEditingPhraseIndex] = useState<number | null>(null)
  const [dragOverLane, setDragOverLane] = useState<string | null>(null)
  const [deletingLane, setDeletingLane] = useState<string | null>(null)
  const [deleteReassignTo, setDeleteReassignTo] = useState<string>('')
  const [mergingLane, setMergingLane] = useState<string | null>(null)
  const [mergeTarget, setMergeTarget] = useState<string>('')

  // Escape to deselect
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedPhraseIndex(null)
        setEditingPhraseIndex(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Phrase timing drag state
  const [shiftDrag, setShiftDrag] = useState<{ phraseIndex: number; offsetPx: number } | null>(null)
  const shiftDragRef = useRef<{ startX: number; phraseIndex: number } | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Zoom state: pixels per second
  const [pps, setPps] = useState(DEFAULT_PPS)

  // Ctrl+Wheel zoom + regular scroll to pan horizontally
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        // Zoom toward cursor position
        e.preventDefault()
        e.stopPropagation()

        const rect = el!.getBoundingClientRect()
        const cursorX = e.clientX - rect.left + el!.scrollLeft
        const cursorTimeSec = cursorX / ppsRef.current

        const factor = e.deltaY > 0 ? 0.85 : 1.18
        const newPps = Math.min(MAX_PPS, Math.max(MIN_PPS, ppsRef.current * factor))
        setPps(newPps)

        // Keep the time under the cursor at the same screen position
        requestAnimationFrame(() => {
          const newCursorX = cursorTimeSec * newPps
          el!.scrollLeft = newCursorX - (e.clientX - rect.left)
        })
      } else {
        // Vertical scroll → horizontal pan
        e.preventDefault()
        el!.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  const ppsRef = useRef(pps)
  ppsRef.current = pps

  // Playhead: poll current video time via rAF
  const [playheadX, setPlayheadX] = useState<number>(0)
  const [playheadTime, setPlayheadTime] = useState<number>(0)
  useEffect(() => {
    if (!getCurrentTime) return
    let raf = 0
    const tick = () => {
      const t = getCurrentTime()
      setPlayheadX(t * ppsRef.current)
      setPlayheadTime(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [getCurrentTime])

  // Determine the total timeline duration (from waveform or last word end)
  const totalDuration = waveform?.duration ?? (() => {
    if (!session || session.words.length === 0) return 60
    return Math.ceil(session.words[session.words.length - 1].end) + 2
  })()

  const timelineWidth = Math.ceil(totalDuration * pps)

  const phrases = session?.phrases ?? []
  const phraseLaneOverrides = useSubtitleStore((s) => s.phraseLaneOverrides)
  const laneCount = useSubtitleStore((s) => s.laneCount)
  const lanes = buildSpeakerLanes(phrases, speakerNames)
  const lanesHeight = Math.max(1, lanes.length) * LANE_HEIGHT

  const selectedPhrase = selectedPhraseIndex !== null ? phrases[selectedPhraseIndex] : null
  const allSpeakerIds = Object.keys(speakerNames)

  // Center the horizontal scroll viewport on a given time — reused for both the
  // initial mount-to-Word-Timing-stage focus and programmatic phrase navigation
  // (mirrors the auto-follow-playhead scroll math from MiniTimeline's zoom feature).
  const centerViewportOnTime = useCallback((timeSec: number) => {
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollLeft = Math.max(0, timeSec * ppsRef.current - el.clientWidth / 2)
  }, [])

  // Auto-focus the playhead when entering Word Timing mode: TimingEditor is
  // conditionally mounted per-stage, so this fires once each time the user
  // switches to Word Timing, centering the viewport instead of leaving it at
  // the t=0 default (which otherwise requires manual scrolling to find the
  // playhead, e.g. after transcribing/scrubbing while on another stage).
  useEffect(() => {
    if (!getCurrentTime) return
    const t = getCurrentTime()
    requestAnimationFrame(() => centerViewportOnTime(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only; playhead movement during playback should not re-center
  }, [])

  // External phrase focus (prev/next nav buttons in the phrase override panel):
  // select the phrase, seek, and center the viewport — consistent with a direct click.
  useEffect(() => {
    if (!focusSignal) return
    const { phraseIndex } = focusSignal
    setSelectedPhraseIndex(phraseIndex)
    const phrase = phrases[phraseIndex]
    if (phrase && phrase.words.length > 0) {
      const start = phrase.words[0].start
      seekToTime(start)
      requestAnimationFrame(() => centerViewportOnTime(start))
    }
  }, [focusSignal, phrases, seekToTime, centerViewportOnTime])

  // Prev/next same-speaker phrase navigation (buttons live in the phrase detail
  // panel header). Behaves like clicking the target phrase: select it, sync the
  // right-hand style panel, seek, and center the viewport.
  const handleNavigatePhrase = useCallback((direction: 1 | -1) => {
    if (selectedPhraseIndex === null) return
    const target = findAdjacentSameSpeakerPhrase(phrases, selectedPhraseIndex, direction)
    if (target === null) return
    setSelectedPhraseIndex(target)
    onEditPhrase?.(target)
    const phrase = phrases[target]
    if (phrase && phrase.words.length > 0) {
      const start = phrase.words[0].start
      seekToTime(start)
      requestAnimationFrame(() => centerViewportOnTime(start))
    }
  }, [selectedPhraseIndex, phrases, onEditPhrase, seekToTime, centerViewportOnTime])

  // ←/→ hotkeys for prev/next same-speaker phrase navigation. Scoped to Word
  // Timing mode by construction (TimingEditor is only mounted on that stage)
  // and bound only while a phrase is selected. Never fires while the user is
  // typing in an input/textarea/select/contentEditable, and leaves modified
  // combos (Alt+←/→ browser nav, etc.) untouched.
  useEffect(() => {
    if (selectedPhraseIndex === null) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) return
      e.preventDefault()
      handleNavigatePhrase(e.key === 'ArrowLeft' ? -1 : 1)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedPhraseIndex, handleNavigatePhrase])

  const handlePhraseClick = useCallback((phraseIndex: number) => {
    const deselecting = selectedPhraseIndex === phraseIndex
    setSelectedPhraseIndex(deselecting ? null : phraseIndex)
    if (deselecting) {
      onEditPhrase?.(phraseIndex) // close side panel on deselect will be handled by parent
    } else {
      onEditPhrase?.(phraseIndex)
      const phrase = phrases[phraseIndex]
      if (phrase && phrase.words.length > 0) {
        seekToTime(phrase.words[0].start)
      }
    }
  }, [phrases, seekToTime, selectedPhraseIndex, onEditPhrase])

  const handlePhraseDoubleClick = useCallback((e: React.MouseEvent, phraseIndex: number) => {
    e.stopPropagation()
    setEditingPhraseIndex(phraseIndex)
  }, [])

  const handleInlineEditCommit = useCallback((phraseIndex: number, text: string) => {
    setEditingPhraseIndex(null)
    const trimmed = text.trim()
    if (!trimmed) return
    const newWords = trimmed.split(/\s+/).filter(Boolean)
    if (newWords.length === 0) return
    const phrase = phrases[phraseIndex]
    if (!phrase) return
    const oldText = phrase.words.map((w) => w.word).join(' ')
    if (newWords.join(' ') !== oldText) {
      updatePhraseText(phraseIndex, newWords)
    }
  }, [phrases, updatePhraseText])

  const handleInlineEditCancel = useCallback(() => {
    setEditingPhraseIndex(null)
  }, [])

  const handleEditPhrase = useCallback((e: React.MouseEvent, phraseIndex: number) => {
    e.stopPropagation()
    setSelectedPhraseIndex(phraseIndex)
    if (onEditPhrase) onEditPhrase(phraseIndex)
  }, [onEditPhrase])

  // Click empty space on a lane track → add a new phrase at that time for that speaker
  const handleLaneTrackClick = useCallback((e: React.MouseEvent, speakerId: string) => {
    if (e.target !== e.currentTarget) return // only fire on background, not on phrase blocks
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left + e.currentTarget.scrollLeft
    const timeSec = clickX / pps
    if (timeSec >= 0) {
      addPhraseAtTime(timeSec, speakerId)
    }
  }, [addPhraseAtTime, pps])

  // Delete a phrase block
  const handleDeletePhrase = useCallback((e: React.MouseEvent, phraseIndex: number) => {
    e.stopPropagation()
    deletePhrase(phraseIndex)
    if (selectedPhraseIndex === phraseIndex) {
      setSelectedPhraseIndex(null)
    }
  }, [deletePhrase, selectedPhraseIndex])

  // Phrase timing shift: mousedown records intent, mousemove activates after dead zone,
  // mouseup commits. The dead zone allows double-click to fire for inline editing.
  const shiftPendingRef = useRef<{ startX: number; phraseIndex: number } | null>(null)

  const handlePhraseShiftStart = useCallback((e: React.MouseEvent, phraseIndex: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    // Record intent but don't activate drag yet — wait for movement past dead zone
    shiftPendingRef.current = { startX: e.clientX, phraseIndex }

    const onMove = (moveE: MouseEvent) => {
      if (!shiftPendingRef.current) return
      const dx = moveE.clientX - shiftPendingRef.current.startX
      if (Math.abs(dx) < 3) return // dead zone — don't start drag yet
      // Activate drag
      shiftDragRef.current = shiftPendingRef.current
      shiftPendingRef.current = null
      setShiftDrag({ phraseIndex, offsetPx: dx })
      // Subsequent moves handled by the drag effect below
    }

    const onUp = () => {
      shiftPendingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  useEffect(() => {
    if (!shiftDragRef.current) return

    const onMouseMove = (e: MouseEvent) => {
      if (!shiftDragRef.current) return
      const offsetPx = e.clientX - shiftDragRef.current.startX
      setShiftDrag({ phraseIndex: shiftDragRef.current.phraseIndex, offsetPx })
    }

    const onMouseUp = () => {
      if (!shiftDragRef.current) return
      const { phraseIndex } = shiftDragRef.current
      shiftDragRef.current = null

      setShiftDrag((prev) => {
        if (prev && Math.abs(prev.offsetPx) > 2) {
          const deltaSec = prev.offsetPx / ppsRef.current
          setTimeout(() => shiftPhrase(phraseIndex, deltaSec), 0)
        }
        return null
      })
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [shiftDrag !== null, shiftPhrase]) // eslint-disable-line -- re-bind only when drag starts/stops

  // ── Phrase edge-drag: resize start/end by dragging the chunk's edges ──────
  // Live preview is purely visual (transient state below); the store mutation
  // happens exactly once on mouseup via setPhraseTiming → one undo entry per
  // gesture (setPhraseTiming pushes a single undo snapshot per call).
  const [edgeDrag, setEdgeDrag] = useState<{ phraseIndex: number; edge: 'start' | 'end'; deltaSec: number } | null>(null)
  const edgeDragRef = useRef<{ phraseIndex: number; edge: 'start' | 'end'; deltaSec: number } | null>(null)

  // Mirror setPhraseTiming's clamping (min duration + nearest same-speaker
  // neighbors) so the preview never shows a position the store would reject.
  const clampEdgeDrag = useCallback((phraseIndex: number, edge: 'start' | 'end', deltaSec: number): { start: number; end: number } | null => {
    const phrase = phrases[phraseIndex]
    if (!phrase || phrase.words.length === 0) return null
    const origStart = phrase.words[0].start
    const origEnd = phrase.words[phrase.words.length - 1].end
    if (edge === 'start') {
      let newStart = Math.max(0, origStart + deltaSec)
      for (let pi = phraseIndex - 1; pi >= 0; pi--) {
        const prev = phrases[pi]
        if (prev.words.length === 0) continue
        if (prev.dominantSpeaker !== phrase.dominantSpeaker) continue
        newStart = Math.max(newStart, prev.words[prev.words.length - 1].end)
        break
      }
      newStart = Math.min(newStart, origEnd - MIN_PHRASE_DURATION)
      return { start: newStart, end: origEnd }
    }
    let newEnd = origEnd + deltaSec
    for (let pi = phraseIndex + 1; pi < phrases.length; pi++) {
      const next = phrases[pi]
      if (next.words.length === 0) continue
      if (next.dominantSpeaker !== phrase.dominantSpeaker) continue
      newEnd = Math.min(newEnd, next.words[0].start)
      break
    }
    newEnd = Math.max(newEnd, origStart + MIN_PHRASE_DURATION)
    return { start: origStart, end: newEnd }
  }, [phrases])

  const handleEdgeDragStart = useCallback((e: React.MouseEvent, phraseIndex: number, edge: 'start' | 'end') => {
    if (e.button !== 0) return
    e.preventDefault() // block text selection + native HTML5 drag initiation
    e.stopPropagation() // don't trigger the phrase-block shift drag

    const startX = e.clientX
    edgeDragRef.current = { phraseIndex, edge, deltaSec: 0 }
    setEdgeDrag({ phraseIndex, edge, deltaSec: 0 })

    const onMove = (me: MouseEvent) => {
      if (!edgeDragRef.current) return
      const deltaSec = (me.clientX - startX) / ppsRef.current
      edgeDragRef.current = { phraseIndex, edge, deltaSec }
      setEdgeDrag({ phraseIndex, edge, deltaSec })
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      const drag = edgeDragRef.current
      edgeDragRef.current = null
      setEdgeDrag(null)
      if (!drag) return
      // Single commit per gesture — dead zone matches the shift-drag threshold.
      if (Math.abs(drag.deltaSec) * ppsRef.current > 2) {
        const clamped = clampEdgeDrag(drag.phraseIndex, drag.edge, drag.deltaSec)
        if (clamped) setPhraseTiming(drag.phraseIndex, clamped.start, clamped.end)
      }
    }

    document.body.style.cursor = 'ew-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [clampEdgeDrag, setPhraseTiming])

  // Drag and drop handlers (cross-lane reassignment)
  const handleDragStart = useCallback((e: React.DragEvent, phraseIndex: number) => {
    // Don't start DnD during timing shift or edge resize
    if (shiftDragRef.current || edgeDragRef.current) { e.preventDefault(); return }
    e.dataTransfer.setData('text/plain', String(phraseIndex))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, speakerId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverLane(speakerId)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverLane(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, speakerId: string) => {
    e.preventDefault()
    setDragOverLane(null)
    const phraseIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(phraseIndex)) {
      reassignPhraseSpeaker(phraseIndex, speakerId)
    }
  }, [reassignPhraseSpeaker])

  // Handle delete lane confirmation
  const handleDeleteLane = useCallback((speakerId: string) => {
    // Find first other speaker to pre-select as reassign target
    const other = allSpeakerIds.find((s) => s !== speakerId)
    if (!other) return // Can't delete the only speaker
    setDeletingLane(speakerId)
    setDeleteReassignTo(other)
  }, [allSpeakerIds])

  const confirmDeleteLane = useCallback(() => {
    if (deletingLane && deleteReassignTo) {
      deleteSpeaker(deletingLane, deleteReassignTo)
      setDeletingLane(null)
      setDeleteReassignTo('')
      setSelectedPhraseIndex(null)
    }
  }, [deletingLane, deleteReassignTo, deleteSpeaker])

  const cancelDeleteLane = useCallback(() => {
    setDeletingLane(null)
    setDeleteReassignTo('')
  }, [])

  // Handle merge speaker into another
  const handleMergeLane = useCallback((speakerId: string) => {
    const other = allSpeakerIds.find((s) => s !== speakerId)
    if (!other) return
    setMergingLane(speakerId)
    setMergeTarget(other)
  }, [allSpeakerIds])

  const confirmMergeLane = useCallback(() => {
    if (mergingLane && mergeTarget) {
      deleteSpeaker(mergingLane, mergeTarget)
      setMergingLane(null)
      setMergeTarget('')
      setSelectedPhraseIndex(null)
    }
  }, [mergingLane, mergeTarget, deleteSpeaker])

  const cancelMergeLane = useCallback(() => {
    setMergingLane(null)
    setMergeTarget('')
  }, [])

  // Click on ruler or waveform → seek to that time position
  // The ruler/waveform elements span the full timeline width inside the scroll container,
  // so getBoundingClientRect().left already reflects the scroll offset — no need to add scrollLeft.
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const timeSec = clickX / pps
    seekToTime(Math.max(0, timeSec))
  }, [seekToTime, pps])

  // Build time ruler tick marks: minor ticks every second, labels every 5s
  const rulerTicks = (() => {
    const ticks: Array<{ time: number; major: boolean }> = []
    const totalSecs = Math.ceil(totalDuration)
    for (let t = 0; t <= totalSecs; t++) {
      ticks.push({ time: t, major: t % 5 === 0 })
    }
    return ticks
  })()

  if (!session || phrases.length === 0) {
    return (
      <div className="timing-editor timing-editor--empty">
        <p className="timing-editor__empty-msg">No transcript loaded.</p>
      </div>
    )
  }

  return (
    <div className="timing-editor">
      {/* Diarize progress banner */}
      {diarizeState.status === 'diarizing' && (
        <div className="timing-editor__diarize-banner">
          <span>Detecting speakers... {diarizeState.progress}%</span>
          <div className="timing-editor__diarize-progress-track">
            <div
              className="timing-editor__diarize-progress-fill"
              style={{ width: `${diarizeState.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Horizontally scrollable timeline with speaker lanes */}
      <div className="timing-editor__timeline-scroll" ref={scrollContainerRef}>
        {/* Playhead line */}
        <div
          className="timing-editor__playhead"
          style={{ left: playheadX }}
        >
          <span className="timing-editor__playhead-time">{formatTimePrecise(playheadTime)}</span>
        </div>

        {/* Time ruler */}
        <div className="timing-editor__ruler" style={{ width: timelineWidth }} onClick={handleTimelineClick}>
          {rulerTicks.map(({ time, major }) => (
            <div
              key={time}
              className={`timing-editor__ruler-tick${major ? ' timing-editor__ruler-tick--major' : ''}`}
              style={{ left: time * pps }}
            >
              {major && (
                <span className="timing-editor__ruler-label">{formatTime(time)}</span>
              )}
            </div>
          ))}
        </div>

        {/* Waveform row — above speaker lanes */}
        {waveform && (
          <div className="timing-editor__waveform-row" style={{ width: timelineWidth }} onClick={handleTimelineClick}>
            <WaveformCanvas
              samples={waveform.samples}
              duration={waveform.duration}
              pixelsPerSecond={pps}
              height={48}
            />
          </div>
        )}

        {/* Speaker lanes */}
        <div className="timing-editor__speaker-lanes">
          {lanes.map((lane) => {
            const colorIdx = getSpeakerColorIndex(lane.speakerId)
            const isDragOver = dragOverLane === lane.speakerId
            const isDeleting = deletingLane === lane.speakerId

            return (
              <div
                key={lane.speakerId}
                className={`timing-editor__lane${isDragOver ? ' timing-editor__lane--drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, lane.speakerId)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, lane.speakerId)}
              >
                {/* Lane header (sticky left) */}
                <div className="timing-editor__lane-header" style={{ position: 'relative' }}>
                  <span
                    className="timing-editor__lane-color-bar"
                    style={{ background: `var(--speaker-color-${colorIdx})` }}
                  />
                  <SpeakerNameInput
                    speakerId={lane.speakerId}
                    displayName={speakerNames[lane.speakerId] ?? lane.speakerId}
                    onRename={renameSpeaker}
                  />
                  <div className="timing-editor__lane-actions">
                    {onEditSpeaker && (
                      <button
                        className="timing-editor__lane-edit-btn"
                        type="button"
                        onClick={() => onEditSpeaker(lane.speakerId)}
                        title="Edit speaker style"
                      >
                        ✎
                      </button>
                    )}
                    {allSpeakerIds.length > 1 && (
                      <button
                        className="timing-editor__lane-edit-btn"
                        type="button"
                        onClick={() => handleMergeLane(lane.speakerId)}
                        title="Merge into another speaker"
                      >
                        ⤵
                      </button>
                    )}
                    {allSpeakerIds.length > 1 && (
                      <button
                        className="timing-editor__lane-delete-btn"
                        type="button"
                        onClick={() => handleDeleteLane(lane.speakerId)}
                        title="Delete this speaker lane"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Inline merge confirmation */}
                  {mergingLane === lane.speakerId && (
                    <div className="timing-editor__lane-delete-confirm">
                      <span className="timing-editor__lane-delete-label">Merge into:</span>
                      <select
                        className="timing-editor__lane-delete-select"
                        value={mergeTarget}
                        onChange={(e) => setMergeTarget(e.target.value)}
                      >
                        {allSpeakerIds
                          .filter((s) => s !== lane.speakerId)
                          .map((s) => (
                            <option key={s} value={s}>
                              {speakerNames[s] ?? s}
                            </option>
                          ))}
                      </select>
                      <button
                        className="timing-editor__lane-delete-action timing-editor__lane-delete-action--confirm"
                        type="button"
                        onClick={confirmMergeLane}
                      >
                        Merge
                      </button>
                      <button
                        className="timing-editor__lane-delete-action timing-editor__lane-delete-action--cancel"
                        type="button"
                        onClick={cancelMergeLane}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Inline delete confirmation */}
                  {isDeleting && (
                    <div className="timing-editor__lane-delete-confirm">
                      <span className="timing-editor__lane-delete-label">Reassign to:</span>
                      <select
                        className="timing-editor__lane-delete-select"
                        value={deleteReassignTo}
                        onChange={(e) => setDeleteReassignTo(e.target.value)}
                      >
                        {allSpeakerIds
                          .filter((s) => s !== lane.speakerId)
                          .map((s) => (
                            <option key={s} value={s}>
                              {speakerNames[s] ?? s}
                            </option>
                          ))}
                      </select>
                      <button
                        className="timing-editor__lane-delete-action timing-editor__lane-delete-action--confirm"
                        type="button"
                        onClick={confirmDeleteLane}
                      >
                        Confirm
                      </button>
                      <button
                        className="timing-editor__lane-delete-action timing-editor__lane-delete-action--cancel"
                        type="button"
                        onClick={cancelDeleteLane}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Lane track (scrollable with phrases) — click empty space to add phrase */}
                <div
                  className="timing-editor__lane-track"
                  style={{ width: timelineWidth, height: LANE_HEIGHT }}
                  onClick={(e) => handleLaneTrackClick(e, lane.speakerId)}
                >
                  {/* Phrase blocks in this lane */}
                  {lane.phrases.map(({ phrase, phraseIndex }) => {
                    if (phrase.words.length === 0) return null

                    const firstWord = phrase.words[0]
                    const lastWord = phrase.words[phrase.words.length - 1]
                    const lingerSec = phrase.lingerDuration ?? globalLingerDuration

                    // Live edge-drag preview: visually stretch this block (and
                    // rescale its word markers) without touching the store; the
                    // single store commit happens on mouseup.
                    const isEdgeDragging = edgeDrag?.phraseIndex === phraseIndex
                    const edgePreview = isEdgeDragging
                      ? clampEdgeDrag(phraseIndex, edgeDrag.edge, edgeDrag.deltaSec)
                      : null
                    const blockStart = edgePreview?.start ?? firstWord.start
                    const blockEnd = edgePreview?.end ?? lastWord.end

                    const left = blockStart * pps
                    const wordsWidth = (blockEnd - blockStart) * pps
                    const lingerWidth = lingerSec * pps
                    const width = Math.max(4, wordsWidth + lingerWidth)
                    const origWordsDuration = lastWord.end - firstWord.start

                    const isSelected = selectedPhraseIndex === phraseIndex
                    const isEditing = editingPhraseIndex === phraseIndex
                    const phraseText = phrase.words.map((w) => w.word).join(' ')
                    const blockBg = `var(--speaker-color-${colorIdx}, rgba(0, 230, 150, 0.4))`

                    // Apply visual offset during timing shift drag
                    const isDragging = shiftDrag?.phraseIndex === phraseIndex
                    const visualLeft = isDragging ? left + shiftDrag.offsetPx : left

                    return (
                      <div
                        key={phraseIndex}
                        className={`timing-editor__phrase-block${isSelected ? ' timing-editor__phrase-block--selected' : ''}${isDragging ? ' timing-editor__phrase-block--dragging' : ''}${isEdgeDragging ? ' timing-editor__phrase-block--edge-dragging' : ''}${isEditing ? ' timing-editor__phrase-block--editing' : ''}`}
                        style={{ left: visualLeft, width, background: blockBg, zIndex: isSelected || isEdgeDragging ? 10 : undefined }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isDragging && !isEditing) handlePhraseClick(phraseIndex)
                        }}
                        onDoubleClick={(e) => handlePhraseDoubleClick(e, phraseIndex)}
                        title={isEditing ? undefined : phraseText}
                        onMouseDown={(e) => {
                          if (!isEditing) handlePhraseShiftStart(e, phraseIndex)
                        }}
                        draggable={!isEditing}
                        onDragStart={(e) => handleDragStart(e, phraseIndex)}
                      >
                        {/* Linger tail — semi-transparent extension after last word */}
                        {lingerWidth > 0 && (
                          <span
                            className="timing-editor__linger-tail"
                            style={{ left: wordsWidth, width: lingerWidth }}
                          />
                        )}
                        {/* Word-end markers (red lines showing where each word ends) —
                            scaled to the preview width during an edge drag so they
                            mirror the proportional word rescale setPhraseTiming applies */}
                        {phrase.words.length > 1 && phrase.words.slice(0, -1).map((w, wi) => (
                          <span
                            key={wi}
                            className="timing-editor__word-end-marker"
                            style={{
                              left: origWordsDuration > 0
                                ? ((w.end - firstWord.start) / origWordsDuration) * wordsWidth
                                : 0,
                            }}
                          />
                        ))}
                        {/* Edge-drag grab zones: resize phrase start/end */}
                        {!isEditing && (
                          <>
                            <span
                              className="timing-editor__phrase-edge-handle timing-editor__phrase-edge-handle--start"
                              onMouseDown={(e) => handleEdgeDragStart(e, phraseIndex, 'start')}
                              onClick={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => e.stopPropagation()}
                              title="Drag to adjust phrase start"
                            />
                            <span
                              className="timing-editor__phrase-edge-handle timing-editor__phrase-edge-handle--end"
                              onMouseDown={(e) => handleEdgeDragStart(e, phraseIndex, 'end')}
                              onClick={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => e.stopPropagation()}
                              title="Drag to adjust phrase end"
                            />
                          </>
                        )}
                        {isEditing ? (
                          <InlinePhraseInput
                            initialText={phraseText}
                            onCommit={(text) => handleInlineEditCommit(phraseIndex, text)}
                            onCancel={handleInlineEditCancel}
                          />
                        ) : (
                          <span className="timing-editor__phrase-text">{phraseText}</span>
                        )}
                        {/* Lane override selector */}
                        <select
                          className="timing-editor__phrase-lane-select"
                          value={phraseLaneOverrides[phraseIndex] ?? ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation()
                            const val = e.target.value
                            setPhraseLane(phraseIndex, val === '' ? null : parseInt(val, 10))
                          }}
                          title="Assign to lane"
                        >
                          <option value="">Auto</option>
                          {Array.from({ length: laneCount }).map((_, li) => (
                            <option key={li} value={li}>L{li + 1}</option>
                          ))}
                        </select>
                        <button
                          className="timing-editor__phrase-edit"
                          type="button"
                          onClick={(e) => handleEditPhrase(e, phraseIndex)}
                          title="Edit phrase style"
                        >
                          ✎
                        </button>
                        <button
                          className="timing-editor__phrase-delete"
                          type="button"
                          onClick={(e) => handleDeletePhrase(e, phraseIndex)}
                          title="Delete phrase"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="timing-editor__zoom-bar">
        <span className="timing-editor__zoom-hint">Ctrl+Scroll to zoom</span>
        <div className="timing-editor__zoom-group">
          <button
            className="timing-editor__zoom-btn"
            onClick={() => setPps((p) => Math.max(MIN_PPS, p * 0.75))}
            title="Zoom out"
          >-</button>
          <button
            className="timing-editor__zoom-btn"
            onClick={() => setPps(DEFAULT_PPS)}
            title="Reset zoom"
          >Fit</button>
          <button
            className="timing-editor__zoom-btn"
            onClick={() => setPps((p) => Math.min(MAX_PPS, p * 1.33))}
            title="Zoom in"
          >+</button>
          <span className="timing-editor__zoom-level">{Math.round(pps / DEFAULT_PPS * 100)}%</span>
        </div>
      </div>

      {/* Detail panel for selected phrase */}
      {selectedPhrase !== null && selectedPhraseIndex !== null && (
        <PhraseDetailPanel
          phrase={selectedPhrase}
          phraseIndex={selectedPhraseIndex}
          totalPhrases={phrases.length}
          speakerNames={speakerNames}
          allSpeakerIds={allSpeakerIds}
          hasPrevPhrase={findAdjacentSameSpeakerPhrase(phrases, selectedPhraseIndex, -1) !== null}
          hasNextPhrase={findAdjacentSameSpeakerPhrase(phrases, selectedPhraseIndex, 1) !== null}
          onNavigatePhrase={handleNavigatePhrase}
          onSetWordTransition={(wordIndex, newTime) => {
            // Compute global word index for this phrase
            let globalOffset = 0
            for (let i = 0; i < selectedPhraseIndex; i++) {
              globalOffset += phrases[i].words.length
            }
            setWordTransition(globalOffset + wordIndex, newTime)
          }}
          onSplitPhrase={(splitBeforeWordIndex) => {
            splitPhrase(selectedPhraseIndex, splitBeforeWordIndex)
          }}
          onAddWord={() => {
            addWord(selectedPhraseIndex)
          }}
          globalLingerDuration={globalLingerDuration}
          onLingerChange={(lingerSec) => {
            setPhraseLinger(selectedPhraseIndex, lingerSec)
          }}
          onReassignSpeaker={(speakerId) => {
            reassignPhraseSpeaker(selectedPhraseIndex, speakerId)
          }}
          onSeekTo={(timeSec) => seekToTime(timeSec)}
          onHighlightDisabledChange={(disabled) => {
            setPhraseHighlightDisabled(selectedPhraseIndex, disabled)
          }}
          onSetPhraseTiming={(startSec, endSec) => {
            setPhraseTiming(selectedPhraseIndex, startSec, endSec)
          }}
        />
      )}
    </div>
  )
}

// ── Speaker Name Input (editable on blur/Enter) ─────────────────────────────

interface SpeakerNameInputProps {
  speakerId: string
  displayName: string
  onRename: (speakerId: string, name: string) => void
}

function SpeakerNameInput({ speakerId, displayName, onRename }: SpeakerNameInputProps) {
  const [draft, setDraft] = useState(displayName)

  useEffect(() => {
    setDraft(displayName)
  }, [displayName])

  const commit = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== displayName) {
      onRename(speakerId, trimmed)
    } else {
      setDraft(displayName)
    }
  }, [draft, displayName, speakerId, onRename])

  return (
    <input
      className="timing-editor__lane-name-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
    />
  )
}

// ── Phrase Detail Panel ─────────────────────────────────────────────────────

interface PhraseDetailPanelProps {
  phrase: SessionPhrase
  phraseIndex: number
  totalPhrases: number
  speakerNames: Record<string, string>
  allSpeakerIds: string[]
  hasPrevPhrase: boolean
  hasNextPhrase: boolean
  onNavigatePhrase: (direction: 1 | -1) => void
  /** Move the shared boundary between phrase-local word `wordIndex` and the next word. */
  onSetWordTransition: (wordIndex: number, newTime: number) => void
  onSplitPhrase: (splitBeforeWordIndex: number) => void
  onAddWord: () => void
  globalLingerDuration: number
  onLingerChange: (lingerSec: number) => void
  onReassignSpeaker: (speakerId: string) => void
  onSeekTo: (timeSec: number) => void
  onHighlightDisabledChange: (disabled: boolean) => void
  onSetPhraseTiming: (startSec: number, endSec: number) => void
}

function PhraseDetailPanel({
  phrase,
  phraseIndex,
  totalPhrases,
  speakerNames,
  allSpeakerIds,
  hasPrevPhrase,
  hasNextPhrase,
  onNavigatePhrase,
  onSetWordTransition,
  onSplitPhrase,
  onAddWord,
  globalLingerDuration,
  onLingerChange,
  onReassignSpeaker,
  onSeekTo,
  onHighlightDisabledChange,
  onSetPhraseTiming,
}: PhraseDetailPanelProps) {
  const lingerValue = phrase.lingerDuration ?? globalLingerDuration
  const phraseStart = phrase.words.length > 0 ? phrase.words[0].start : 0
  const phraseEnd = phrase.words.length > 0 ? phrase.words[phrase.words.length - 1].end : 0
  const speakerLabel = phrase.dominantSpeaker
    ? (speakerNames[phrase.dominantSpeaker] ?? phrase.dominantSpeaker)
    : null

  return (
    <div className="timing-editor__detail-panel">
      {/* Panel header */}
      <div className="timing-editor__detail-header">
        <span className="timing-editor__detail-title">
          Phrase {phraseIndex + 1}
          {speakerLabel && (
            <span className="timing-editor__detail-speaker"> — {speakerLabel}</span>
          )}
        </span>
        <div className="timing-editor__detail-nav">
          <button
            type="button"
            className="timing-editor__detail-nav-btn"
            onClick={() => onNavigatePhrase(-1)}
            disabled={!hasPrevPhrase}
            title="Previous phrase (same speaker)"
          >
            ←
          </button>
          <button
            type="button"
            className="timing-editor__detail-nav-btn"
            onClick={() => onNavigatePhrase(1)}
            disabled={!hasNextPhrase}
            title="Next phrase (same speaker)"
          >
            →
          </button>
        </div>
      </div>

      {/* Move to speaker dropdown */}
      {allSpeakerIds.length > 1 && (
        <div className="timing-editor__move-speaker-row">
          <label className="timing-editor__move-speaker-label">
            Move to speaker:
          </label>
          <select
            className="timing-editor__move-speaker-select"
            value={phrase.dominantSpeaker ?? ''}
            onChange={(e) => onReassignSpeaker(e.target.value)}
          >
            {allSpeakerIds.map((sid) => (
              <option key={sid} value={sid}>
                {speakerNames[sid] ?? sid}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Per-phrase linger slider */}
      <div className="timing-editor__linger-row">
        <label className="timing-editor__linger-label">
          Linger
          <span className="timing-editor__linger-value">{lingerValue.toFixed(1)}s</span>
        </label>
        <input
          type="range"
          className="timing-editor__linger-slider"
          min={0}
          max={5}
          step={0.1}
          value={lingerValue}
          onChange={(e) => onLingerChange(parseFloat(e.target.value))}
        />
      </div>

      {/* Per-phrase highlight disable */}
      <div className="timing-editor__linger-row">
        <label className="timing-editor__linger-label" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={phrase.highlightDisabled ?? false}
            onChange={(e) => onHighlightDisabledChange(e.target.checked)}
            style={{ marginRight: 6, accentColor: 'var(--color-accent-green)' }}
          />
          Disable highlighting
        </label>
      </div>

      {/* Word transitions: draggable markers between adjacent words,
          bookended by the phrase start/end inputs at the row's two ends */}
      <div className="timing-editor__word-transitions">
        {phrase.words.length > 0 && (
          <div className="timing-editor__transition-marker timing-editor__transition-marker--phrase-edge">
            <ScrubbableTimeInput
              value={phraseStart}
              onCommit={(newStart) => onSetPhraseTiming(Math.max(0, newStart), phraseEnd)}
              ariaLabel="Phrase start time"
              title="Phrase start — drag to scrub, Shift+drag for fine adjust"
            />
          </div>
        )}
        {phrase.words.map((word, wordIndex) => (
          <div key={wordIndex} className="timing-editor__word-transition-group">
            {/* The word label */}
            <span
              className="timing-editor__word-label"
              onClick={() => onSeekTo(word.start)}
              title={`${word.word} (${word.start.toFixed(2)}s – ${word.end.toFixed(2)}s)`}
            >
              {word.word}
            </span>

            {/* Transition marker between this word and the next */}
            {wordIndex < phrase.words.length - 1 && (
              <div className="timing-editor__transition-marker">
                <ScrubbableTimeInput
                  value={word.end}
                  onCommit={(newTime) => onSetWordTransition(wordIndex, newTime)}
                  ariaLabel={`Transition time after word ${wordIndex + 1}`}
                />
              </div>
            )}
          </div>
        ))}
        {phrase.words.length > 0 && (
          <div className="timing-editor__transition-marker timing-editor__transition-marker--phrase-edge">
            <ScrubbableTimeInput
              value={phraseEnd}
              onCommit={(newEnd) => onSetPhraseTiming(phraseStart, Math.max(0, newEnd))}
              ariaLabel="Phrase end time"
              title="Phrase end — drag to scrub, Shift+drag for fine adjust"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Scrubbable Time Input (shared: word boundaries + phrase start/end) ──────

interface ScrubbableTimeInputProps {
  value: number
  onCommit: (newValue: number) => void
  ariaLabel: string
  title?: string
}

/**
 * Numeric time input with DAW-style horizontal drag-to-scrub, shared by the
 * per-word boundary inputs and the phrase start/end inputs. A plain click
 * (within the 3px dead zone) focuses for typing; dragging scrubs the displayed
 * draft live (~0.01s/px, Shift = 0.001s/px) and commits the store write exactly
 * once on mouseup — one undo entry per gesture. Enter/blur commit typed values;
 * Escape cancels (reverts the draft, no commit) for both typing and scrubbing.
 */
function ScrubbableTimeInput({ value, onCommit, ariaLabel, title }: ScrubbableTimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(value.toFixed(3))
  const cancelRef = useRef(false)
  const activeCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setDraft(value.toFixed(3))
  }, [value])

  // Detach document listeners if the input unmounts mid-drag (e.g. the phrase
  // detail panel closes underneath us).
  useEffect(() => () => { activeCleanupRef.current?.() }, [])

  const commitTyped = useCallback(() => {
    if (cancelRef.current) {
      // Escape pressed: revert without committing.
      cancelRef.current = false
      setDraft(value.toFixed(3))
      return
    }
    const val = parseFloat(draft)
    if (!isNaN(val) && val !== value) {
      onCommit(Math.max(0, val))
    }
    // Snap back to the store value; if the commit changed the store, the
    // value-sync effect overwrites this with the fresh value. If the store
    // clamped or rejected the change, this snaps back to reality.
    setDraft(value.toFixed(3))
  }, [draft, value, onCommit])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    // Already focused → the user is editing text; let the browser place the caret.
    if (document.activeElement === inputRef.current) return
    e.preventDefault() // no text selection; focus is granted on clean click at mouseup

    const startX = e.clientX
    let moved = false
    let scrubVal = value

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - startX
      if (!moved) {
        if (Math.abs(dx) < 3) return // dead zone — plain click still focuses for typing
        moved = true
        document.body.style.cursor = 'ew-resize'
      }
      const sensitivity = me.shiftKey ? 0.001 : 0.01
      scrubVal = Math.max(0, value + dx * sensitivity)
      setDraft(scrubVal.toFixed(3))
    }

    const cleanup = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('keydown', onKey, true)
      document.body.style.cursor = ''
      activeCleanupRef.current = null
    }

    const onUp = () => {
      cleanup()
      if (moved) {
        // Single store commit per scrub gesture → one undo entry.
        onCommit(scrubVal)
        setDraft(value.toFixed(3)) // value-sync effect takes over if the store changed
      } else {
        // Clean click: enter typing mode.
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }

    const onKey = (ke: KeyboardEvent) => {
      if (ke.key !== 'Escape') return
      // Cancel the scrub without committing; swallow the event so the global
      // Escape handler doesn't also deselect the phrase mid-gesture.
      ke.preventDefault()
      ke.stopImmediatePropagation()
      cleanup()
      setDraft(value.toFixed(3))
    }

    activeCleanupRef.current = cleanup
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('keydown', onKey, true) // capture: runs before the global Escape deselect
  }, [value, onCommit])

  return (
    <input
      ref={inputRef}
      type="number"
      className="timing-editor__timestamp-input timing-editor__timestamp-input--draggable"
      value={draft}
      step={0.001}
      min={0}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitTyped}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur() // blur → commitTyped
        } else if (e.key === 'Escape') {
          e.stopPropagation() // don't let the global handler deselect the phrase
          cancelRef.current = true
          ;(e.target as HTMLInputElement).blur() // blur → revert via cancelRef
        }
      }}
      onMouseDown={handleMouseDown}
      aria-label={ariaLabel}
      title={title ?? 'Drag to scrub, Shift+drag for fine adjust'}
    />
  )
}

// ── Inline Phrase Text Input ────────────────────────────────────────────────

interface InlinePhraseInputProps {
  initialText: string
  onCommit: (text: string) => void
  onCancel: () => void
}

function InlinePhraseInput({ initialText, onCommit, onCancel }: InlinePhraseInputProps) {
  const [draft, setDraft] = useState(initialText)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onCommit(draft)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    e.stopPropagation()
  }, [draft, onCommit, onCancel])

  return (
    <input
      ref={inputRef}
      className="timing-editor__phrase-inline-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    />
  )
}
