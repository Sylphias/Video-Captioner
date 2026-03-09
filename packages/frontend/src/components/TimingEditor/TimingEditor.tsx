import { useState, useRef, useCallback, useEffect } from 'react'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import { useWaveform } from '../../hooks/useWaveform.ts'
import { WaveformCanvas } from './WaveformCanvas.tsx'
import type { SessionPhrase, SessionWord } from '../../store/subtitleStore.ts'
import type { DiarizeState } from '../../hooks/useDiarize.ts'
import './TimingEditor.css'

interface TimingEditorProps {
  seekToTime: (timeSec: number) => void
  jobId: string
  diarizeState: DiarizeState
  diarize: (jobId: string, numSpeakers?: number) => void
  numSpeakers: number | undefined
  setNumSpeakers: (n: number | undefined) => void
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

/** Get speaker color index (0-7) from a speaker ID. */
function getSpeakerColorIndex(speakerId: string): number {
  return parseInt(speakerId.replace('SPEAKER_', ''), 10) % 8
}

export function TimingEditor({
  seekToTime,
  jobId,
  diarizeState,
  diarize,
  numSpeakers,
  setNumSpeakers,
}: TimingEditorProps) {
  const session = useSubtitleStore((s) => s.session)
  const speakerNames = useSubtitleStore((s) => s.speakerNames)
  const {
    splitPhrase,
    mergePhrase,
    updateWord,
    setPhraseLinger,
    renameSpeaker,
    reassignPhraseSpeaker,
    deleteSpeaker,
    deletePhrase,
    addPhraseAtTime,
    shiftPhrase,
  } = useSubtitleStore()

  const { waveform } = useWaveform(jobId)

  const [selectedPhraseIndex, setSelectedPhraseIndex] = useState<number | null>(null)
  const [dragOverLane, setDragOverLane] = useState<string | null>(null)
  const [deletingLane, setDeletingLane] = useState<string | null>(null)
  const [deleteReassignTo, setDeleteReassignTo] = useState<string>('')

  // Phrase timing drag state
  const [shiftDrag, setShiftDrag] = useState<{ phraseIndex: number; offsetPx: number } | null>(null)
  const shiftDragRef = useRef<{ startX: number; phraseIndex: number } | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  // Phrase timing shift: mousedown starts, mousemove updates visual offset, mouseup commits
  const handlePhraseShiftStart = useCallback((e: React.MouseEvent, phraseIndex: number) => {
    // Only left button, ignore if clicking delete button
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    shiftDragRef.current = { startX: e.clientX, phraseIndex }
    setShiftDrag({ phraseIndex, offsetPx: 0 })
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
          // Use setTimeout to avoid setState-during-render
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
        {/* Time ruler */}
        <div className="timing-editor__ruler" style={{ width: timelineWidth }}>
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
          <div className="timing-editor__waveform-row" style={{ width: timelineWidth }}>
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
                    const left = firstWord.start * PIXELS_PER_SECOND
                    const width = Math.max(4, (lastWord.end - firstWord.start) * PIXELS_PER_SECOND)

                    const isSelected = selectedPhraseIndex === phraseIndex
                    const phraseText = phrase.words.map((w) => w.word).join(' ')
                    const blockBg = `var(--speaker-color-${colorIdx}, rgba(0, 230, 150, 0.4))`

                    // Apply visual offset during timing shift drag
                    const isDragging = shiftDrag?.phraseIndex === phraseIndex
                    const visualLeft = isDragging ? left + shiftDrag.offsetPx : left

                    return (
                      <div
                        key={phraseIndex}
                        className={`timing-editor__phrase-block${isSelected ? ' timing-editor__phrase-block--selected' : ''}${isDragging ? ' timing-editor__phrase-block--dragging' : ''}`}
                        style={{ left: visualLeft, width, background: blockBg }}
                        onClick={(e) => {
                          e.stopPropagation()
                          // Don't select if we just finished a drag
                          if (!isDragging) handlePhraseClick(phraseIndex)
                        }}
                        title={phraseText}
                        onMouseDown={(e) => handlePhraseShiftStart(e, phraseIndex)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, phraseIndex)}
                      >
                        <span className="timing-editor__phrase-text">{phraseText}</span>
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
            updateWord(globalOffset + wordIndex, patch)
          }}
          onSplitPhrase={(splitBeforeWordIndex) => {
            splitPhrase(selectedPhraseIndex, splitBeforeWordIndex)
          }}
          onMergePhrase={() => {
            mergePhrase(selectedPhraseIndex)
          }}
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
  onLingerChange,
  onReassignSpeaker,
  onSeekTo,
}: PhraseDetailPanelProps) {
  const lingerValue = phrase.lingerDuration ?? 1.0
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
  // Local state for controlled timestamp inputs (allows typing without committing on each keystroke)
  const [startDraft, setStartDraft] = useState(word.start.toFixed(3))
  const [endDraft, setEndDraft] = useState(word.end.toFixed(3))

  // Sync drafts when word props change (e.g. after an undo)
  useEffect(() => {
    setStartDraft(word.start.toFixed(3))
  }, [word.start])

  useEffect(() => {
    setEndDraft(word.end.toFixed(3))
  }, [word.end])

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

      {/* Word text (click to seek) */}
      <button
        type="button"
        className="timing-editor__word-text"
        onClick={() => onSeekTo(word.start)}
        title={`Seek to "${word.word}"`}
      >
        {word.word}
      </button>

      {/* Start timestamp input */}
      <input
        type="number"
        className="timing-editor__timestamp-input"
        value={startDraft}
        step={0.001}
        onChange={(e) => setStartDraft(e.target.value)}
        onBlur={commitStart}
        onKeyDown={(e) => { if (e.key === 'Enter') commitStart() }}
        aria-label={`Start time for "${word.word}"`}
      />

      {/* End timestamp input */}
      <input
        type="number"
        className="timing-editor__timestamp-input"
        value={endDraft}
        step={0.001}
        onChange={(e) => setEndDraft(e.target.value)}
        onBlur={commitEnd}
        onKeyDown={(e) => { if (e.key === 'Enter') commitEnd() }}
        aria-label={`End time for "${word.word}"`}
      />

    </div>
  )
}
