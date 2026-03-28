import { useCallback, useEffect, useRef, useState } from 'react'
import { useUpload } from '../hooks/useUpload.ts'
import { useTranscribe } from '../hooks/useTranscribe.ts'
import { useDiarize } from '../hooks/useDiarize.ts'
import { useRender } from '../hooks/useRender.ts'
import { UploadZone } from '../components/UploadZone.tsx'
import { PreviewPanel } from '../components/PreviewPanel.tsx'
import { StageTabBar, type StageId } from '../components/StageTabBar.tsx'
import { StyleDrawer, type DrawerMode } from '../components/StyleDrawer/StyleDrawer.tsx'
import { TextEditor } from '../components/TextEditor/TextEditor.tsx'
import { TimingEditor } from '../components/TimingEditor/TimingEditor.tsx'
import { AnimationEditor } from '../components/AnimationEditor/AnimationEditor.tsx'
import { useSubtitleStore, restoreSnapshot } from '../store/subtitleStore.ts'
import { useUndoStore } from '../store/undoMiddleware.ts'
import './SubtitlesPage.css'

// Toast state for stage transition notifications
interface StageToast {
  message: string
  key: number
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function SubtitlesPage() {
  const { state: uploadState, upload, reset: resetUpload } = useUpload()
  const { state: transcribeState, transcribe, reset: resetTranscribe } = useTranscribe()
  const { state: diarizeState, diarize, reset: resetDiarize } = useDiarize()
  const { state: renderState, render, reset: resetRender } = useRender()
  const [seekToTime, setSeekToTime] = useState<((timeSec: number) => void) | null>(null)
  const [getCurrentTime, setGetCurrentTime] = useState<(() => number) | null>(null)
  const [numSpeakers, setNumSpeakers] = useState<number | undefined>(undefined)
  const [topPercent, setTopPercent] = useState(45)
  const [activeStage, setActiveStage] = useState<StageId>('timing')
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [stageToast, setStageToast] = useState<StageToast | null>(null)
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null)
  const [timeShift, setTimeShift] = useState(0)
  const timeShiftDragRef = useRef(false)
  const timeShiftBaselineRef = useRef<import('../store/subtitleStore.ts').SessionWord[] | null>(null)

  const handleTimeShiftMouseDown = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    if (document.activeElement === e.currentTarget) return
    const startX = e.clientX
    timeShiftDragRef.current = false
    const input = e.currentTarget

    const onMove = (moveE: MouseEvent) => {
      const deltaX = moveE.clientX - startX
      if (!timeShiftDragRef.current && Math.abs(deltaX) < 3) return

      // On first real drag movement: capture baseline and push undo once
      if (!timeShiftDragRef.current) {
        timeShiftDragRef.current = true
        document.body.style.cursor = 'ew-resize'
        const storeState = useSubtitleStore.getState()
        if (storeState.session) {
          timeShiftBaselineRef.current = structuredClone(storeState.session.words)
          // Push undo snapshot manually (same shape as handleUndo)
          const { session, style, speakerNames, speakerStyles, maxWordsPerPhrase } = storeState
          useUndoStore.getState().pushSnapshot({
            session: session ? {
              words: structuredClone(session.words),
              phrases: structuredClone(session.phrases),
              manualSplitWordIndices: Array.from(session.manualSplitWordIndices),
            } : null,
            style: structuredClone(style) as unknown as Record<string, unknown>,
            maxWordsPerPhrase,
            speakerNames: { ...speakerNames },
            speakerStyles: structuredClone(speakerStyles) as unknown as Record<string, Record<string, unknown>>,
          })
        }
      }

      const scale = moveE.shiftKey ? 0.002 : 0.01
      const newVal = parseFloat((deltaX * scale).toFixed(2))
      setTimeShift(newVal)

      // Apply live shift from baseline
      if (timeShiftBaselineRef.current) {
        useSubtitleStore.getState().applyWordShift(timeShiftBaselineRef.current, newVal)
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      timeShiftBaselineRef.current = null
      if (timeShiftDragRef.current) {
        setTimeShift(0)
        input.blur()
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])
  const containerRef = useRef<HTMLDivElement>(null)

  // Tracks original phrase texts at transcription time for the Text->Timing transition
  // confirmation toast. Captured once when session first loads; updated on re-transcribe.
  // Each entry is the joined word text of the corresponding phrase at load time.
  const originalPhraseTextsRef = useRef<string[]>([])

  // Subscribe to undo/redo availability for button states
  const canUndo = useUndoStore((s) => s.canUndo)
  const canRedo = useUndoStore((s) => s.canRedo)

  const speakerNames = useSubtitleStore((s) => s.speakerNames)

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const startY = e.clientY
    const startPercent = topPercent

    const onMove = (moveE: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const deltaPercent = ((moveE.clientY - startY) / rect.height) * 100
      const newPercent = Math.min(75, Math.max(20, startPercent + deltaPercent))
      setTopPercent(newPercent)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }

    document.body.style.cursor = 'row-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [topPercent])

  const handleGoToSubtitle = useCallback(() => {
    if (!getCurrentTime) return
    const timeSec = getCurrentTime()
    const session = useSubtitleStore.getState().session
    if (!session) return

    // Binary search for the word active at timeSec
    const words = session.words
    let lo = 0, hi = words.length - 1, bestIdx = 0
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (words[mid].start <= timeSec) {
        bestIdx = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    // Scroll that word into view
    const el = document.querySelector(`[data-word-index="${bestIdx}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Brief highlight flash
      el.classList.add('word-cell--flash')
      setTimeout(() => el.classList.remove('word-cell--flash'), 1000)
    }
  }, [getCurrentTime])

  const handleUndo = useCallback(() => {
    const storeState = useSubtitleStore.getState()
    const { session, style, speakerNames, speakerStyles } = storeState

    // Build current snapshot to push to future stack
    const currentSnapshot = {
      session: session
        ? {
            words: structuredClone(session.words),
            phrases: structuredClone(session.phrases),
            manualSplitWordIndices: Array.from(session.manualSplitWordIndices),
          }
        : null,
      style: structuredClone(style) as unknown as Record<string, unknown>,
      speakerNames: { ...speakerNames },
      speakerStyles: structuredClone(speakerStyles) as unknown as Record<string, Record<string, unknown>>,
    }

    const target = useUndoStore.getState().undo(currentSnapshot)
    if (target) {
      restoreSnapshot(target)
    }
  }, [])

  const handleRedo = useCallback(() => {
    const storeState = useSubtitleStore.getState()
    const { session, style, speakerNames, speakerStyles } = storeState

    const currentSnapshot = {
      session: session
        ? {
            words: structuredClone(session.words),
            phrases: structuredClone(session.phrases),
            manualSplitWordIndices: Array.from(session.manualSplitWordIndices),
          }
        : null,
      style: structuredClone(style) as unknown as Record<string, unknown>,
      speakerNames: { ...speakerNames },
      speakerStyles: structuredClone(speakerStyles) as unknown as Record<string, Record<string, unknown>>,
    }

    const target = useUndoStore.getState().redo(currentSnapshot)
    if (target) {
      restoreSnapshot(target)
    }
  }, [])

  // Stage transition handler with confirmation toast on Text -> other stage.
  //
  // Timestamp preservation note: going back from later stages to Text preserves
  // timing adjustments on unchanged words. This is the default store behavior:
  // - updateWord(idx, { word: text }) only touches the 'word' field, never timestamps.
  // - updatePhraseText redistributes timestamps only for phrases whose word count changed.
  // So back-navigation from Timing/Speakers/Styling to Text does NOT clobber timing data.
  const handleStageChange = useCallback((newStage: StageId) => {
    if (activeStage === 'text' && newStage !== 'text') {
      // Compute how many phrases differ from the original (phrase-level comparison).
      // This avoids word-index mismatches that occur when word counts change inside phrases
      // (splits, merges, text edits that change word count via updatePhraseText).
      const session = useSubtitleStore.getState().session
      let modifiedCount = 0
      if (session) {
        session.phrases.forEach((phrase, i) => {
          const currentText = phrase.words.map((w) => w.word).join(' ')
          const originalText = originalPhraseTextsRef.current[i] ?? ''
          if (currentText !== originalText) {
            modifiedCount++
          }
        })
      }

      const message =
        modifiedCount === 0
          ? 'No text changes.'
          : `Text changes saved. ${modifiedCount} ${modifiedCount === 1 ? 'phrase' : 'phrases'} modified.`

      setStageToast({ message, key: Date.now() })
    }

    setActiveStage(newStage)
  }, [activeStage])

  const resetAll = () => {
    resetUpload()
    resetTranscribe()
    resetDiarize()
    resetRender()
    useSubtitleStore.getState().reset()
  }

  // Auto-transcribe as soon as upload completes
  useEffect(() => {
    if (uploadState.status !== 'ready') return
    if (!uploadState.jobId) return
    if (transcribeState.status !== 'idle') return
    transcribe(uploadState.jobId, numSpeakers)
  }, [uploadState.status, uploadState.jobId, transcribeState.status, transcribe, numSpeakers])

  // Push job data into Zustand store when transcription completes so PreviewPanel can consume it
  useEffect(() => {
    if (transcribeState.status !== 'transcribed') return
    const jobId = uploadState.jobId
    const transcript = transcribeState.transcript
    const metadata = uploadState.job?.metadata
    if (!jobId || !transcript || !metadata) return
    useSubtitleStore.getState().setJob(jobId, transcript, metadata)

    // Capture original phrase texts for the Text->Timing transition confirmation toast.
    // We snapshot this here (after setJob) so originalPhraseTextsRef always reflects the
    // state at the moment transcription completed (or re-transcription completed).
    const session = useSubtitleStore.getState().session
    if (session) {
      originalPhraseTextsRef.current = session.phrases.map((p) =>
        p.words.map((w) => w.word).join(' ')
      )
    }
  }, [transcribeState.status, uploadState.jobId, transcribeState.transcript, uploadState.job])

  // When diarization completes, switch to Timing stage with toast
  useEffect(() => {
    if (diarizeState.status !== 'done') return
    setActiveStage('timing')
    setStageToast({ message: 'Speaker detection complete.', key: Date.now() })
  }, [diarizeState.status])

  // Global Cmd+Z / Cmd+Shift+Z keyboard shortcuts for undo/redo
  // Only active when transcription is complete (editing is live)
  useEffect(() => {
    if (transcribeState.status !== 'transcribed') return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod || e.key !== 'z') return

      e.preventDefault()

      if (e.shiftKey) {
        handleRedo()
      } else {
        handleUndo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [transcribeState.status, handleUndo, handleRedo])

  // State: idle — show upload zone
  if (uploadState.status === 'idle') {
    return (
      <div className="subtitles-page subtitles-page--centered">
        <UploadZone onFile={upload} />
      </div>
    )
  }

  // State: uploading or normalizing — show progress
  if (uploadState.status === 'uploading' || uploadState.status === 'normalizing') {
    const label =
      uploadState.status === 'uploading'
        ? `Uploading... ${uploadState.progress}%`
        : `Normalizing video... ${uploadState.progress}%`

    return (
      <div className="subtitles-page subtitles-page--centered">
        <div className="subtitles-page__progress-card">
          {uploadState.job?.originalFilename && (
            <p className="subtitles-page__filename">{uploadState.job.originalFilename}</p>
          )}
          <p className="subtitles-page__status-label">{label}</p>
          <div className="subtitles-page__progress-track">
            <div
              className="subtitles-page__progress-fill"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // State: failed — show error (covers both upload and transcription failures)
  if (uploadState.status === 'failed' || transcribeState.status === 'failed') {
    const errorMsg =
      transcribeState.status === 'failed'
        ? (transcribeState.error ?? 'Transcription failed')
        : (uploadState.error ?? 'An unexpected error occurred')

    return (
      <div className="subtitles-page subtitles-page--centered">
        <div className="subtitles-page__error-card">
          <p className="subtitles-page__error-message">{errorMsg}</p>
          <button className="subtitles-page__retry-btn" onClick={resetAll}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  // State: transcribing — show video info + transcription progress
  if (transcribeState.status === 'transcribing') {
    const { job, jobId } = uploadState

    return (
      <div className="subtitles-page subtitles-page--centered">
        <div className="subtitles-page__ready-card">
          {jobId && (
            <img
              className="subtitles-page__thumbnail"
              src={`/api/jobs/${jobId}/thumbnail`}
              alt="Video thumbnail"
            />
          )}

          <div className="subtitles-page__meta">
            {job?.originalFilename && (
              <p className="subtitles-page__meta-filename">{job.originalFilename}</p>
            )}
          </div>

          <div className="subtitles-page__progress-card">
            <p className="subtitles-page__status-label">
              Transcribing... {transcribeState.progress}%
            </p>
            <div className="subtitles-page__progress-track">
              <div
                className="subtitles-page__progress-fill"
                style={{ width: `${transcribeState.progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // State: transcribed — show 4-stage editing layout
  if (transcribeState.status === 'transcribed' && transcribeState.transcript) {
    return (
      <div className="subtitles-page subtitles-page--preview" ref={containerRef}>
        {/* Top: preview panel */}
        <div
          className={`subtitles-page__top${previewCollapsed ? ' subtitles-page__top--collapsed' : ''}`}
          style={previewCollapsed ? undefined : { height: `${topPercent}%` }}
        >
          <PreviewPanel
            onSeekReady={(fn) => setSeekToTime(() => fn)}
            onGetTimeReady={(fn) => setGetCurrentTime(() => fn)}
            collapsed={previewCollapsed}
            onToggleCollapse={() => setPreviewCollapsed((c) => !c)}
            showSpeakerBorders={activeStage === 'timing'}
          />

          {!previewCollapsed && (
            <div className="subtitles-page__top-controls">
              <button
                className="subtitles-page__goto-btn"
                onClick={handleGoToSubtitle}
              >
                Go to subtitle
              </button>

              {/* Undo / Redo buttons */}
              <div className="subtitles-page__undo-controls">
                <button
                  className="subtitles-page__undo-btn"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo (Cmd+Z)"
                >
                  Undo
                </button>
                <button
                  className="subtitles-page__undo-btn"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo (Cmd+Shift+Z)"
                >
                  Redo
                </button>
              </div>

              <div className="subtitles-page__time-shift">
                <label className="subtitles-page__time-shift-label">Shift</label>
                <input
                  type="number"
                  className="subtitles-page__time-shift-input"
                  step={0.1}
                  value={timeShift}
                  onChange={(e) => setTimeShift(e.target.valueAsNumber || 0)}
                  onMouseDown={handleTimeShiftMouseDown}
                  title="Drag sideways to scrub, Shift+drag for fine adjust"
                />
                <span className="subtitles-page__time-shift-unit">s</span>
                <button
                  className="subtitles-page__time-shift-btn"
                  onClick={() => {
                    if (timeShift !== 0) {
                      useSubtitleStore.getState().shiftAllWords(timeShift)
                      setTimeShift(0)
                    }
                  }}
                >
                  Apply
                </button>
                <button
                  className="subtitles-page__time-shift-btn"
                  onClick={() => setTimeShift(0)}
                >
                  Reset
                </button>
              </div>

              <div className="subtitles-page__render-controls">
                <button
                  className="subtitles-page__render-btn"
                  onClick={() => render(uploadState.jobId!)}
                  disabled={renderState.status === 'rendering'}
                >
                  {renderState.status === 'rendering'
                    ? `Rendering... ${renderState.progress}%`
                    : renderState.status === 'rendered'
                      ? 'Re-render MP4'
                      : renderState.status === 'failed'
                        ? 'Retry render'
                        : 'Render MP4'}
                </button>

                {renderState.status === 'rendered' && (
                  <a
                    className="subtitles-page__download-btn"
                    href={`/api/jobs/${uploadState.jobId}/download`}
                    download
                  >
                    Download MP4
                  </a>
                )}
              </div>

              <button
                className="subtitles-page__styling-btn"
                type="button"
                onClick={() => setDrawerMode({ type: 'global' })}
              >
                Global Styling
              </button>

              <div className="subtitles-page__speaker-controls">
                <label className="subtitles-page__speakers-label">
                  Speakers
                  <input
                    type="number"
                    className="subtitles-page__speakers-input"
                    min={1}
                    max={20}
                    placeholder="Auto"
                    value={numSpeakers ?? ''}
                    onChange={(e) => setNumSpeakers(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </label>
                <button
                  className="subtitles-page__diarize-btn"
                  onClick={() => diarize(uploadState.jobId!, numSpeakers)}
                  disabled={diarizeState.status === 'diarizing'}
                >
                  {diarizeState.status === 'diarizing'
                    ? `Detecting... ${diarizeState.progress}%`
                    : 'Re-detect speakers'}
                </button>
              </div>

              {renderState.status === 'rendering' && (
                <div className="subtitles-page__render-progress">
                  <div className="subtitles-page__progress-track">
                    <div
                      className="subtitles-page__progress-fill"
                      style={{ width: `${renderState.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {renderState.status === 'failed' && renderState.error && (
                <p className="subtitles-page__render-error">{renderState.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Resize handle (only visible when preview expanded) */}
        {!previewCollapsed && (
          <div className="subtitles-page__resize-handle" onMouseDown={handleResizeMouseDown}>
            <div className="subtitles-page__resize-grip" />
          </div>
        )}

        {/* Bottom: stage tab bar + editor content */}
        <div
          className="subtitles-page__editor-scroll"
          style={previewCollapsed ? undefined : { height: `${100 - topPercent}%` }}
        >
          {stageToast && (
            <div
              key={stageToast.key}
              className="subtitles-page__stage-toast"
              onAnimationEnd={() => setStageToast(null)}
            >
              {stageToast.message}
            </div>
          )}
          <StageTabBar activeStage={activeStage} onStageChange={handleStageChange} />

          <div className="subtitles-page__editor-section">
            {activeStage === 'text' && (
              <TextEditor
                seekToTime={seekToTime ?? (() => {})}
                getCurrentTime={getCurrentTime}
              />
            )}

            {activeStage === 'timing' && (
              <TimingEditor
                seekToTime={seekToTime ?? (() => {})}
                getCurrentTime={getCurrentTime}
                jobId={uploadState.jobId!}
                diarizeState={diarizeState}
                diarize={diarize}
                numSpeakers={numSpeakers}
                setNumSpeakers={setNumSpeakers}
                onEditSpeaker={(speakerId) => setDrawerMode({ type: 'speaker', speakerId })}
                onEditPhrase={(phraseIndex) => setDrawerMode({ type: 'phrase', phraseIndex })}
              />
            )}

            {activeStage === 'animation' && (
              <AnimationEditor />
            )}

          </div>

          <button
            className="subtitles-page__transcribe-btn subtitles-page__transcribe-btn--narrow"
            onClick={() => transcribe(uploadState.jobId!, numSpeakers)}
          >
            Re-transcribe
          </button>

          <button className="subtitles-page__reset-btn" onClick={resetAll}>
            Upload another video
          </button>
        </div>

        <StyleDrawer mode={drawerMode} onClose={() => setDrawerMode(null)} />
      </div>
    )
  }

  // State: ready — auto-transcribe fires immediately, show transcribing progress
  return (
    <div className="subtitles-page subtitles-page--centered">
      <div className="subtitles-page__progress-card">
        <p className="subtitles-page__status-label">Preparing to transcribe...</p>
      </div>
    </div>
  )
}
