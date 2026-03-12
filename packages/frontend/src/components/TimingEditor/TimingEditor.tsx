import { useState, useRef, useCallback, useEffect } from 'react'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import { useWaveform } from '../../hooks/useWaveform.ts'
import { WaveformCanvas } from './WaveformCanvas.tsx'
import type { SessionPhrase, SessionWord } from '../../store/subtitleStore.ts'
import type { DiarizeState } from '../../hooks/useDiarize.ts'
import './TimingEditor.css'

interface TimingEditorProps {
  seekToTime: (timeSec: number) => void
  getCurrentTime?: (() => number) | null
  jobId: string
  diarizeState: DiarizeState
  diarize: (jobId: string, numSpeakers?: number) => void
  numSpeakers: number | undefined
  setNumSpeakers: (n: number | undefined) => void
  onEditSpeaker?: (speakerId: string) => void
  onEditPhrase?: (phraseIndex: number) => void
}

const PIXELS_PER_SECOND = 100
const LANE_HEIGHT = 44
const RULER_HEIGHT = 24

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

  // Only return lanes that have phrases or are in speakerNames
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
  return parseInt(speakerId.replace('SPEAKER_', ''), 10) % 8
}

export function TimingEditor({
  seekToTime,
  getCurrentTime,
  jobId,
  diarizeState,
  diarize,
  numSpeakers,
  setNumSpeakers,
  onEditSpeaker,
  onEditPhrase,
}: TimingEditorProps) {
  const session = useSubtitleStore((s) => s.session)
  const speakerNames = useSubtitleStore((s) => s.speakerNames)
  const globalLingerDuration = useSubtitleStore((s) => s.style.lingerDuration ?? 1.0)
  const {
    splitPhrase,
    mergePhrase,
    updateWord,
    updatePhraseText,
    setPhraseLinger,
    renameSpeaker,
    reassignPhraseSpeaker,
    deleteSpeaker,
    deletePhrase,
    addPhraseAtTime,
    addWord,
    shiftPhrase,
  } = useSubtitleStore()

  const { waveform } = useWaveform(jobId)

  const [selectedPhraseIndex, setSelectedPhraseIndex] = useState<number | null>(null)
  const [editingPhraseIndex, setEditingPhraseIndex] = useState<number | null>(null)
  const [dragOverLane, setDragOverLane] = useState<string | null>(null)
  const [deletingLane, setDeletingLane] = useState<string | null>(null)
  const [deleteReassignTo, setDeleteReassignTo] = useState<string>('')

  // Phrase timing drag state
  const [shiftDrag, setShiftDrag] = useState<{ phraseIndex: number; offsetPx: number } | null>(null)
  const shiftDragRef = useRef<{ startX: number; phraseIndex: number } | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Playhead: poll current video time via rAF
  const [playheadX, setPlayheadX] = useState<number>(0)
  const [playheadTime, setPlayheadTime] = useState<number>(0)
  useEffect(() => {
    if (!getCurrentTime) return
    let raf = 0
    const tick = () => {
      const t = getCurrentTime()
      setPlayheadX(t * PIXELS_PER_SECOND)
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

  const timelineWidth = Math.ceil(totalDuration * PIXELS_PER_SECOND)

  const phrases = session?.phrases ?? []
  const lanes = buildSpeakerLanes(phrases, speakerNames)
  const lanesHeight = Math.max(1, lanes.length) * LANE_HEIGHT

  const selectedPhrase = selectedPhraseIndex !== null ? phrases[selectedPhraseIndex] : null
  const allSpeakerIds = Object.keys(speakerNames)

  const handlePhraseClick = useCallback((phraseIndex: number) => {
    setSelectedPhraseIndex((prev) => prev === phraseIndex ? null : phraseIndex)
    const phrase = phrases[phraseIndex]
    if (phrase && phrase.words.length > 0) {
      seekToTime(phrase.words[0].start)
    }
  }, [phrases, seekToTime])

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
    const timeSec = clickX / PIXELS_PER_SECOND
    if (timeSec >= 0) {
      addPhraseAtTime(timeSec, speakerId)
    }
  }, [addPhraseAtTime])

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
          const deltaSec = prev.offsetPx / PIXELS_PER_SECOND
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

  // Drag and drop handlers (cross-lane reassignment)
  const handleDragStart = useCallback((e: React.DragEvent, phraseIndex: number) => {
    // Don't start DnD during timing shift
    if (shiftDragRef.current) { e.preventDefault(); return }
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

  // Click on ruler or waveform → seek to that time position
  // The ruler/waveform elements span the full timeline width inside the scroll container,
  // so getBoundingClientRect().left already reflects the scroll offset — no need to add scrollLeft.
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const timeSec = clickX / PIXELS_PER_SECOND
    seekToTime(Math.max(0, timeSec))
  }, [seekToTime])

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

      {/* Re-diarize controls */}
      {diarizeState.status !== 'diarizing' && (
        <div className="timing-editor__diarize-controls">
          <label className="timing-editor__speakers-label">
            Speakers
            <input
              type="number"
              className="timing-editor__speakers-input"
              min={1}
              max={20}
              placeholder="Auto"
              value={numSpeakers ?? ''}
              onChange={(e) => setNumSpeakers(e.target.value ? Number(e.target.value) : undefined)}
            />
          </label>
          <button
            className="timing-editor__diarize-btn"
            onClick={() => diarize(jobId, numSpeakers)}
          >
            {diarizeState.status === 'done' ? 'Re-detect speakers' : 'Detect speakers'}
          </button>
          {diarizeState.status === 'failed' && diarizeState.error && (
            <span className="timing-editor__diarize-error">{diarizeState.error}</span>
          )}
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
              style={{ left: time * PIXELS_PER_SECOND }}
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
              pixelsPerSecond={PIXELS_PER_SECOND}
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
                <div className="timing-editor__lane-header">
                  <span
                    className="timing-editor__lane-dot"
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
                        className="timing-editor__lane-delete-btn"
                        type="button"
                        onClick={() => handleDeleteLane(lane.speakerId)}
                        title="Delete this speaker lane"
                      >
                        ×
                      </button>
                    )}
                  </div>

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
                    const left = firstWord.start * PIXELS_PER_SECOND
                    const wordsWidth = (lastWord.end - firstWord.start) * PIXELS_PER_SECOND
                    const lingerWidth = lingerSec * PIXELS_PER_SECOND
                    const width = Math.max(4, wordsWidth + lingerWidth)

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
                        className={`timing-editor__phrase-block${isSelected ? ' timing-editor__phrase-block--selected' : ''}${isDragging ? ' timing-editor__phrase-block--dragging' : ''}${isEditing ? ' timing-editor__phrase-block--editing' : ''}`}
                        style={{ left: visualLeft, width, background: blockBg }}
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
                        {/* Word-end markers (red lines showing where each word ends) */}
                        {phrase.words.length > 1 && phrase.words.slice(0, -1).map((w, wi) => (
                          <span
                            key={wi}
                            className="timing-editor__word-end-marker"
                            style={{ left: (w.end - firstWord.start) * PIXELS_PER_SECOND }}
                          />
                        ))}
                        {isEditing ? (
                          <InlinePhraseInput
                            initialText={phraseText}
                            onCommit={(text) => handleInlineEditCommit(phraseIndex, text)}
                            onCancel={handleInlineEditCancel}
                          />
                        ) : (
                          <span className="timing-editor__phrase-text">{phraseText}</span>
                        )}
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

      {/* Detail panel for selected phrase */}
      {selectedPhrase !== null && selectedPhraseIndex !== null && (
        <PhraseDetailPanel
          phrase={selectedPhrase}
          phraseIndex={selectedPhraseIndex}
          totalPhrases={phrases.length}
          speakerNames={speakerNames}
          allSpeakerIds={allSpeakerIds}
          onUpdateWord={(wordIndex, patch) => {
            // Compute global word index
            let globalOffset = 0
            for (let i = 0; i < selectedPhraseIndex; i++) {
              globalOffset += phrases[i].words.length
            }
            // Clamp end time: cannot exceed next word's end - 0.1s
            if (patch.end !== undefined && wordIndex < selectedPhrase.words.length - 1) {
              const nextWord = selectedPhrase.words[wordIndex + 1]
              const maxEnd = nextWord.end - 0.1
              patch = { ...patch, end: Math.min(patch.end, maxEnd) }
            }
            updateWord(globalOffset + wordIndex, patch)
            // When end time changes, cascade to next word's start time
            if (patch.end !== undefined && wordIndex < selectedPhrase.words.length - 1) {
              updateWord(globalOffset + wordIndex + 1, { start: patch.end })
            }
          }}
          onSplitPhrase={(splitBeforeWordIndex) => {
            splitPhrase(selectedPhraseIndex, splitBeforeWordIndex)
          }}
          onMergePhrase={() => {
            mergePhrase(selectedPhraseIndex)
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
  onUpdateWord: (wordIndex: number, patch: Partial<Pick<SessionWord, 'word' | 'start' | 'end'>>) => void
  onSplitPhrase: (splitBeforeWordIndex: number) => void
  onMergePhrase: () => void
  onAddWord: () => void
  globalLingerDuration: number
  onLingerChange: (lingerSec: number) => void
  onReassignSpeaker: (speakerId: string) => void
  onSeekTo: (timeSec: number) => void
}

function PhraseDetailPanel({
  phrase,
  phraseIndex,
  totalPhrases,
  speakerNames,
  allSpeakerIds,
  onUpdateWord,
  onSplitPhrase,
  onMergePhrase,
  onAddWord,
  globalLingerDuration,
  onLingerChange,
  onReassignSpeaker,
  onSeekTo,
}: PhraseDetailPanelProps) {
  const lingerValue = phrase.lingerDuration ?? globalLingerDuration
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

        {/* Merge button */}
        {phraseIndex < totalPhrases - 1 && (
          <button
            type="button"
            className="timing-editor__merge-btn"
            onClick={onMergePhrase}
            title="Merge with next phrase"
          >
            Merge with next
          </button>
        )}
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

      {/* Word-level timestamp editing */}
      <div className="timing-editor__words-table">
        <div className="timing-editor__words-header">
          <span>Split</span>
          <span>Word</span>
          <span>Start (s)</span>
          <span>End (s)</span>
        </div>

        {phrase.words.map((word, wordIndex) => (
          <WordTimingRow
            key={wordIndex}
            word={word}
            wordIndex={wordIndex}
            onUpdateWord={onUpdateWord}
            onSplitBefore={() => onSplitPhrase(wordIndex)}
            onSeekTo={onSeekTo}
          />
        ))}

        <button
          type="button"
          className="timing-editor__add-word-btn"
          onClick={onAddWord}
          title="Add a word after the last word in this phrase"
        >
          + Add word
        </button>
      </div>
    </div>
  )
}

// ── Word Timing Row ─────────────────────────────────────────────────────────

interface WordTimingRowProps {
  word: SessionWord
  wordIndex: number
  onUpdateWord: (wordIndex: number, patch: Partial<Pick<SessionWord, 'word' | 'start' | 'end'>>) => void
  onSplitBefore: () => void
  onSeekTo: (timeSec: number) => void
}

function WordTimingRow({
  word,
  wordIndex,
  onUpdateWord,
  onSplitBefore,
  onSeekTo,
}: WordTimingRowProps) {
  // Local state for controlled inputs (allows typing without committing on each keystroke)
  const [wordDraft, setWordDraft] = useState(word.word)
  const [startDraft, setStartDraft] = useState(word.start.toFixed(3))
  const [endDraft, setEndDraft] = useState(word.end.toFixed(3))

  // Sync drafts when word props change (e.g. after an undo)
  useEffect(() => {
    setWordDraft(word.word)
  }, [word.word])

  useEffect(() => {
    setStartDraft(word.start.toFixed(3))
  }, [word.start])

  useEffect(() => {
    setEndDraft(word.end.toFixed(3))
  }, [word.end])

  const commitWord = useCallback(() => {
    const trimmed = wordDraft.trim()
    if (trimmed && trimmed !== word.word) {
      onUpdateWord(wordIndex, { word: trimmed })
    } else {
      setWordDraft(word.word)
    }
  }, [wordDraft, wordIndex, onUpdateWord, word.word])

  const commitStart = useCallback(() => {
    const val = parseFloat(startDraft)
    if (!isNaN(val)) {
      onUpdateWord(wordIndex, { start: val })
    } else {
      setStartDraft(word.start.toFixed(3))
    }
  }, [startDraft, wordIndex, onUpdateWord, word.start])

  const commitEnd = useCallback(() => {
    const val = parseFloat(endDraft)
    if (!isNaN(val)) {
      onUpdateWord(wordIndex, { end: val })
    } else {
      setEndDraft(word.end.toFixed(3))
    }
  }, [endDraft, wordIndex, onUpdateWord, word.end])

  // Drag-to-adjust: horizontal scrub on timestamp inputs
  // 100px of mouse movement = 1 second of change
  const dragRef = useRef<{ startX: number; startVal: number; field: 'start' | 'end' } | null>(null)

  const handleDragStart = useCallback((e: React.MouseEvent, field: 'start' | 'end') => {
    // Only initiate drag on middle area of input (not spinner buttons)
    if (e.button !== 0) return
    const startVal = field === 'start' ? word.start : word.end
    dragRef.current = { startX: e.clientX, startVal, field }

    const handleMove = (me: MouseEvent) => {
      if (!dragRef.current) return
      const dx = me.clientX - dragRef.current.startX
      // 100px = 1 second; hold shift for fine mode (100px = 0.1s)
      const sensitivity = me.shiftKey ? 0.001 : 0.01
      const newVal = Math.max(0, dragRef.current.startVal + dx * sensitivity)
      const formatted = newVal.toFixed(3)
      if (dragRef.current.field === 'start') {
        setStartDraft(formatted)
        onUpdateWord(wordIndex, { start: newVal })
      } else {
        setEndDraft(formatted)
        onUpdateWord(wordIndex, { end: newVal })
      }
    }

    const handleUp = () => {
      dragRef.current = null
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    document.body.style.cursor = 'ew-resize'
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [word.start, word.end, wordIndex, onUpdateWord])

  return (
    <div className="timing-editor__word-row">
      {/* Split button: shown before each word (except the first) */}
      {wordIndex > 0 ? (
        <button
          type="button"
          className="timing-editor__split-btn"
          onClick={onSplitBefore}
          title={`Split phrase before "${word.word}"`}
        >
          |
        </button>
      ) : (
        <span className="timing-editor__split-placeholder" />
      )}

      {/* Word text (editable, click seek icon to seek) */}
      <input
        type="text"
        className="timing-editor__word-text-input"
        value={wordDraft}
        onChange={(e) => setWordDraft(e.target.value)}
        onBlur={commitWord}
        onKeyDown={(e) => { if (e.key === 'Enter') commitWord() }}
        aria-label={`Word text "${word.word}"`}
      />

      {/* Start timestamp input — drag horizontally to scrub */}
      <input
        type="number"
        className="timing-editor__timestamp-input timing-editor__timestamp-input--draggable"
        value={startDraft}
        step={0.001}
        onChange={(e) => setStartDraft(e.target.value)}
        onBlur={commitStart}
        onKeyDown={(e) => { if (e.key === 'Enter') commitStart() }}
        onMouseDown={(e) => handleDragStart(e, 'start')}
        aria-label={`Start time for "${word.word}"`}
        title="Drag to scrub, Shift+drag for fine adjust"
      />

      {/* End timestamp input — drag horizontally to scrub */}
      <input
        type="number"
        className="timing-editor__timestamp-input timing-editor__timestamp-input--draggable"
        value={endDraft}
        step={0.001}
        onChange={(e) => setEndDraft(e.target.value)}
        onBlur={commitEnd}
        onKeyDown={(e) => { if (e.key === 'Enter') commitEnd() }}
        onMouseDown={(e) => handleDragStart(e, 'end')}
        aria-label={`End time for "${word.word}"`}
        title="Drag to scrub, Shift+drag for fine adjust"
      />

    </div>
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
