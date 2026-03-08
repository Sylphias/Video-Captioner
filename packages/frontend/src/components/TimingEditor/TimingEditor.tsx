import { useState, useRef, useCallback, useEffect } from 'react'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import { useWaveform } from '../../hooks/useWaveform.ts'
import { WaveformCanvas } from './WaveformCanvas.tsx'
import type { SessionPhrase, SessionWord } from '../../store/subtitleStore.ts'
import './TimingEditor.css'

interface TimingEditorProps {
  seekToTime: (timeSec: number) => void
  jobId: string
}

const PIXELS_PER_SECOND = 100
const LANE_HEIGHT = 44
const RULER_HEIGHT = 24

/** Assign phrases to non-overlapping lanes using a greedy algorithm. */
function assignLanes(phrases: SessionPhrase[]): number[] {
  const lanes: number[] = new Array(phrases.length).fill(0)
  // Track the end time of the last phrase in each lane
  const laneEndTimes: number[] = []

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i]
    if (phrase.words.length === 0) continue

    const start = phrase.words[0].start
    const end = phrase.words[phrase.words.length - 1].end

    // Find the lowest lane where this phrase doesn't overlap
    let assignedLane = -1
    for (let lane = 0; lane < laneEndTimes.length; lane++) {
      if (start >= laneEndTimes[lane]) {
        assignedLane = lane
        break
      }
    }

    if (assignedLane === -1) {
      // All lanes are occupied — create a new lane (cap at 2 to keep 3 total)
      assignedLane = Math.min(laneEndTimes.length, 2)
    }

    lanes[i] = assignedLane
    laneEndTimes[assignedLane] = end
  }

  return lanes
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

export function TimingEditor({ seekToTime, jobId }: TimingEditorProps) {
  const session = useSubtitleStore((s) => s.session)
  const speakerNames = useSubtitleStore((s) => s.speakerNames)
  const { splitPhrase, mergePhrase, updateWord, setPhraseLinger } = useSubtitleStore()

  const { waveform } = useWaveform(jobId)

  const [selectedPhraseIndex, setSelectedPhraseIndex] = useState<number | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Determine the total timeline duration (from waveform or last word end)
  const totalDuration = waveform?.duration ?? (() => {
    if (!session || session.words.length === 0) return 60
    return Math.ceil(session.words[session.words.length - 1].end) + 2
  })()

  const timelineWidth = Math.ceil(totalDuration * PIXELS_PER_SECOND)

  const phrases = session?.phrases ?? []
  const laneCounts = assignLanes(phrases)
  const maxLane = phrases.length > 0 ? Math.max(...laneCounts) : 0
  const lanesHeight = (maxLane + 1) * LANE_HEIGHT

  const selectedPhrase = selectedPhraseIndex !== null ? phrases[selectedPhraseIndex] : null

  const handlePhraseClick = useCallback((phraseIndex: number) => {
    setSelectedPhraseIndex((prev) => prev === phraseIndex ? null : phraseIndex)
    const phrase = phrases[phraseIndex]
    if (phrase && phrase.words.length > 0) {
      seekToTime(phrase.words[0].start)
    }
  }, [phrases, seekToTime])

  // Deselect when clicking the timeline background
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelectedPhraseIndex(null)
    }
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
      {/* Horizontally scrollable timeline */}
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

        {/* Waveform + phrase blocks layer */}
        <div
          className="timing-editor__lanes"
          style={{ width: timelineWidth, height: lanesHeight + RULER_HEIGHT }}
          onClick={handleTimelineClick}
        >
          {/* Waveform canvas as background */}
          {waveform && (
            <div className="timing-editor__waveform-bg" style={{ width: timelineWidth, height: lanesHeight }}>
              <WaveformCanvas
                samples={waveform.samples}
                duration={waveform.duration}
                pixelsPerSecond={PIXELS_PER_SECOND}
                height={lanesHeight}
              />
            </div>
          )}

          {/* Phrase blocks */}
          {phrases.map((phrase, phraseIndex) => {
            if (phrase.words.length === 0) return null

            const firstWord = phrase.words[0]
            const lastWord = phrase.words[phrase.words.length - 1]
            const left = firstWord.start * PIXELS_PER_SECOND
            const width = Math.max(4, (lastWord.end - firstWord.start) * PIXELS_PER_SECOND)
            const lane = laneCounts[phraseIndex]
            const top = lane * LANE_HEIGHT

            const isSelected = selectedPhraseIndex === phraseIndex
            const phraseText = phrase.words.map((w) => w.word).join(' ')

            // Determine background color
            let blockBg: string
            if (phrase.dominantSpeaker) {
              const colorIdx = getSpeakerColorIndex(phrase.dominantSpeaker)
              blockBg = `var(--speaker-color-${colorIdx}, rgba(0, 230, 150, 0.4))`
            } else {
              blockBg = 'rgba(0, 230, 150, 0.4)'
            }

            return (
              <div
                key={phraseIndex}
                className={`timing-editor__phrase-block${isSelected ? ' timing-editor__phrase-block--selected' : ''}`}
                style={{ left, width, top, background: blockBg }}
                onClick={(e) => {
                  e.stopPropagation()
                  handlePhraseClick(phraseIndex)
                }}
                title={phraseText}
              >
                <span className="timing-editor__phrase-text">{phraseText}</span>
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
            // After split, keep the same index selected (left half)
          }}
          onMergePhrase={() => {
            mergePhrase(selectedPhraseIndex)
            // After merge, keep current index selected
          }}
          onLingerChange={(lingerSec) => {
            setPhraseLinger(selectedPhraseIndex, lingerSec)
          }}
          onSeekTo={(timeSec) => seekToTime(timeSec)}
        />
      )}
    </div>
  )
}

// ── Phrase Detail Panel ─────────────────────────────────────────────────────

interface PhraseDetailPanelProps {
  phrase: SessionPhrase
  phraseIndex: number
  totalPhrases: number
  speakerNames: Record<string, string>
  onUpdateWord: (wordIndex: number, patch: Partial<Pick<SessionWord, 'word' | 'start' | 'end'>>) => void
  onSplitPhrase: (splitBeforeWordIndex: number) => void
  onMergePhrase: () => void
  onLingerChange: (lingerSec: number) => void
  onSeekTo: (timeSec: number) => void
}

function PhraseDetailPanel({
  phrase,
  phraseIndex,
  totalPhrases,
  speakerNames,
  onUpdateWord,
  onSplitPhrase,
  onMergePhrase,
  onLingerChange,
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
