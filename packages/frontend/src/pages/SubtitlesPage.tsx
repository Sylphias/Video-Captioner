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
import { MiniTimeline } from '../components/TextEditor/MiniTimeline.tsx'
import { TimingEditor } from '../components/TimingEditor/TimingEditor.tsx'
import { AnimationEditor } from '../components/AnimationEditor/AnimationEditor.tsx'
import { useSubtitleStore, restoreSnapshot } from '../store/subtitleStore.ts'
import { useUndoStore } from '../store/undoMiddleware.ts'
import { buildStateBlob, loadProjectBlob, type ProjectStateBlob } from '../lib/projectState.ts'
import { useWaveform } from '../hooks/useWaveform.ts'
import { AutoSaveIndicator, type SaveStatus } from '../components/AutoSaveIndicator.tsx'
import { LaneSidePanel } from '../components/LaneSidePanel.tsx'
import { StyleSidePanel, type RightPanelMode } from '../components/PhraseStyleSidePanel.tsx'
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

interface SubtitlesPageProps {
  projectId?: string
  onBack?: () => void
}

export function SubtitlesPage({ projectId, onBack: _onBack }: SubtitlesPageProps) {
  const { state: uploadState, upload, reset: resetUpload, hydrate: hydrateUpload } = useUpload()
  const { state: transcribeState, transcribe, reset: resetTranscribe } = useTranscribe()
  const { state: diarizeState, diarize, reset: resetDiarize } = useDiarize()
  const { state: renderState, render, reset: resetRender } = useRender()
  const [seekToTime, setSeekToTime] = useState<((timeSec: number) => void) | null>(null)
  const [getCurrentTime, setGetCurrentTime] = useState<(() => number) | null>(null)
  const [numSpeakers, setNumSpeakers] = useState<number | undefined>(undefined)
  const [topPercent, setTopPercent] = useState(45)
  const [activeStage, setActiveStage] = useState<StageId>('text')
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [showLaneGuides, setShowLaneGuides] = useState(true)
  const [stageToast, setStageToast] = useState<StageToast | null>(null)
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null)
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode | null>(null)
  const [timeShift, setTimeShift] = useState(0)
  const timeShiftDragRef = useRef(false)
  const timeShiftBaselineRef = useRef<import('../store/subtitleStore.ts').SessionWord[] | null>(null)
  const replaceVideoRef = useRef<HTMLInputElement>(null)
  const [replacingVideo, setReplacingVideo] = useState(false)

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
  const session = useSubtitleStore((s) => s.session)
  const updateWord = useSubtitleStore((s) => s.updateWord)
  const addPhraseAtTime = useSubtitleStore((s) => s.addPhraseAtTime)
  const deletePhrase = useSubtitleStore((s) => s.deletePhrase)
  const shiftPhrase = useSubtitleStore((s) => s.shiftPhrase)
  const reassignPhraseSpeaker = useSubtitleStore((s) => s.reassignPhraseSpeaker)
  const storeJobId = useSubtitleStore((s) => s.jobId)
  // Resolve jobId: prefer store (works for loaded projects), fall back to upload hook
  const resolvedJobId = storeJobId ?? uploadState.jobId ?? null
  // Only fetch waveform once session exists (transcription done → video is normalized)
  const waveformJobId = session ? resolvedJobId : null
  const { waveform } = useWaveform(waveformJobId)

  // Mini timeline: track current time + active phrase for playhead
  const [miniTimelineTime, setMiniTimelineTime] = useState(0)
  const [miniTimelineActivePhrase, setMiniTimelineActivePhrase] = useState<number | null>(null)
  const [hoveredPhraseIndex, setHoveredPhraseIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!getCurrentTime || !session) return
    const interval = setInterval(() => {
      const t = getCurrentTime()
      setMiniTimelineTime(t)
      let found: number | null = null
      for (let i = 0; i < session.phrases.length; i++) {
        const p = session.phrases[i]
        if (p.words.length === 0) continue
        const start = p.words[0].start
        const end = p.words[p.words.length - 1].end
        if (t >= start && t <= end + 0.5) { found = i; break }
      }
      setMiniTimelineActivePhrase(found)
    }, 100)
    return () => clearInterval(interval)
  }, [getCurrentTime, session])

  const miniTimelineTotalDuration = waveform?.duration
    ?? (session
      ? Math.max(...session.phrases.filter(p => p.words.length > 0).map(p => p.words[p.words.length - 1].end), 0)
      : 0)

  // Hotkeys: Ctrl+1 add phrase at playhead, Ctrl+2 delete phrase at playhead
  useEffect(() => {
    if (activeStage !== 'text') return

    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (!getCurrentTime || !session) return

      if (e.key === '1') {
        e.preventDefault()
        const t = getCurrentTime()
        // Use the speaker of the nearest phrase, or first speaker
        const speakerIds = Object.keys(speakerNames)
        let speakerId = speakerIds[0] ?? 'SPEAKER_00'
        // Find the phrase closest to current time for speaker context
        for (const p of session.phrases) {
          if (p.words.length === 0) continue
          const end = p.words[p.words.length - 1].end
          if (end <= t && p.dominantSpeaker) {
            speakerId = p.dominantSpeaker
          }
        }
        addPhraseAtTime(t, speakerId)
      }

      if (e.key === '2') {
        e.preventDefault()
        const t = getCurrentTime()
        // Find the phrase under the playhead
        for (let i = 0; i < session.phrases.length; i++) {
          const p = session.phrases[i]
          if (p.words.length === 0) continue
          const start = p.words[0].start
          const end = p.words[p.words.length - 1].end
          if (t >= start && t <= end + 0.2) {
            deletePhrase(i)
            break
          }
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeStage, getCurrentTime, session, speakerNames, addPhraseAtTime, deletePhrase])

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

    // Find the phrase active at timeSec
    let phraseIdx = -1
    for (let i = 0; i < session.phrases.length; i++) {
      const p = session.phrases[i]
      if (p.words.length === 0) continue
      if (p.words[0].start <= timeSec && p.words[p.words.length - 1].end >= timeSec) {
        phraseIdx = i
        break
      }
    }
    if (phraseIdx < 0) return

    // Try word-level element (TimingEditor)
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
    const wordEl = document.querySelector(`[data-word-index="${bestIdx}"]`)
    if (wordEl) {
      wordEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      wordEl.classList.add('word-cell--flash')
      setTimeout(() => wordEl.classList.remove('word-cell--flash'), 1000)
      return
    }

    // Try phrase-level element (TextEditor)
    const phraseEl = document.querySelector(`[data-phrase-index="${phraseIdx}"]`)
    if (phraseEl) {
      phraseEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [getCurrentTime])

  const handleReplaceVideo = useCallback((file: File) => {
    setReplacingVideo(true)

    const formData = new FormData()
    formData.append('file', file)

    fetch('/api/upload', { method: 'POST', body: formData })
      .then((res) => {
        if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`)
        return res.json() as Promise<{ jobId: string }>
      })
      .then(({ jobId: newJobId }) => {
        // Wait for new job to be ready (poll status)
        const poll = () => {
          fetch(`/api/jobs/${newJobId}`)
            .then((r) => r.json())
            .then((job: import('@eigen/shared-types').Job) => {
              if (job.status === 'ready') {
                // Swap jobId + videoMetadata in store — keeps all subtitle data
                useSubtitleStore.setState({ jobId: newJobId, videoMetadata: job.metadata })
                // Also update the upload hook state so preview uses new video
                hydrateUpload(newJobId, job)
                setReplacingVideo(false)
                resetRender()
              } else if (job.status === 'failed') {
                setReplacingVideo(false)
              } else {
                setTimeout(poll, 1000)
              }
            })
            .catch(() => setReplacingVideo(false))
        }
        poll()
      })
      .catch(() => setReplacingVideo(false))
  }, [hydrateUpload, resetRender])

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

  // Auto-transcribe as soon as upload completes (skip if session already exists, e.g. video replace)
  useEffect(() => {
    if (uploadState.status !== 'ready') return
    if (!uploadState.jobId) return
    if (transcribeState.status !== 'idle') return
    if (useSubtitleStore.getState().session) return // already have subtitles — don't overwrite
    transcribe(uploadState.jobId, numSpeakers)
  }, [uploadState.status, uploadState.jobId, transcribeState.status, transcribe, numSpeakers])

  // Push job data into Zustand store when transcription completes so PreviewPanel can consume it
  useEffect(() => {
    if (transcribeState.status !== 'transcribed') return
    // Skip if session already exists (e.g. replace video changed uploadState.jobId
    // but we don't want to rebuild the session from the original transcript)
    if (useSubtitleStore.getState().session) return
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

  // Load project state from backend when projectId is provided
  const [projectLoaded, setProjectLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  useEffect(() => {
    if (!projectId) {
      setProjectLoaded(true) // No project to load — proceed with fresh state
      return
    }

    // Clear stale store data from any previously-opened project so auto-transcribe
    // and PreviewPanel don't use the old project's session/video.
    useSubtitleStore.getState().reset()

    let cancelled = false
    const loadProject = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) return
        const project = await res.json() as { stateJson: string | null, jobId: string, name: string }

        if (cancelled) return

        if (project.stateJson) {
          const blob = JSON.parse(project.stateJson) as ProjectStateBlob
          loadProjectBlob(blob)
        } else if (project.jobId) {
          // stateJson is null but job exists — fetch job info and hydrate upload state
          // so SubtitlesPage skips to the correct stage (e.g. 'ready' triggers auto-transcribe)
          try {
            const jobRes = await fetch(`/api/jobs/${project.jobId}`)
            if (jobRes.ok) {
              const jobData = await jobRes.json() as import('@eigen/shared-types').Job
              hydrateUpload(project.jobId, jobData)
            } else {
              // Job not in memory (server restarted) — set as ready with no metadata
              // The video files exist on disk; metadata will be re-probed on transcribe
              hydrateUpload(project.jobId, {
                id: project.jobId,
                status: 'ready',
                progress: 100,
                createdAt: Date.now(),
              })
            }
          } catch {
            hydrateUpload(project.jobId, {
              id: project.jobId,
              status: 'ready',
              progress: 100,
              createdAt: Date.now(),
            })
          }
        }
        setProjectLoaded(true)
      } catch {
        setProjectLoaded(true) // proceed even on error
      }
    }
    void loadProject()
    return () => { cancelled = true }
  }, [projectId])

  // Shared save function
  const [isDirty, setIsDirty] = useState(false)
  const saveNow = useCallback(async () => {
    if (!projectId) return
    const blob = buildStateBlob()
    if (!blob) return

    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateJson: JSON.stringify(blob) }),
      })
      setSaveStatus(res.ok ? 'saved' : 'error')
      if (res.ok) setIsDirty(false)
    } catch {
      setSaveStatus('error')
    }
  }, [projectId])

  // D-04: Auto-save on store changes with 4-second debounce + dirty tracking
  useEffect(() => {
    if (!projectId || !projectLoaded) return

    let timer: ReturnType<typeof setTimeout>
    const unsub = useSubtitleStore.subscribe(() => {
      setIsDirty(true)
      clearTimeout(timer)
      timer = setTimeout(() => { void saveNow() }, 4000)
    })

    return () => {
      unsub()
      clearTimeout(timer)
    }
  }, [projectId, projectLoaded, saveNow])

  // Ctrl+S hotkey for immediate save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void saveNow()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [saveNow])

  if (!projectLoaded) return null

  // Check if the Zustand store already has a loaded session (from loadProjectBlob).
  // If so, skip the upload/transcribe flow and go straight to the editor.
  const storeHasSession = useSubtitleStore.getState().session !== null

  // State: idle — show upload zone (only if store doesn't have a loaded session)
  if (uploadState.status === 'idle' && !storeHasSession) {
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

  // State: transcribed OR project loaded from store — show 4-stage editing layout
  if ((transcribeState.status === 'transcribed' && transcribeState.transcript) || storeHasSession) {
    return (
      <div className="subtitles-page subtitles-page--preview" ref={containerRef}>
        {/* Top: side panel + preview panel */}
        <div
          className={`subtitles-page__top${previewCollapsed ? ' subtitles-page__top--collapsed' : ''}`}
          style={previewCollapsed ? undefined : { height: `${topPercent}%` }}
        >
          <div className="subtitles-page__top-row">
            {!previewCollapsed && (
              <LaneSidePanel
                numSpeakers={numSpeakers}
                setNumSpeakers={setNumSpeakers}
                onDetectSpeakers={() => diarize(resolvedJobId!, numSpeakers)}
                detectDisabled={diarizeState.status === 'diarizing'}
                detectLabel={diarizeState.status === 'diarizing'
                  ? `Detecting... ${diarizeState.progress}%`
                  : 'Re-detect speakers'}
                showLaneGuides={showLaneGuides}
                onToggleLaneGuides={() => setShowLaneGuides((v) => !v)}
              />
            )}
            <PreviewPanel
              onSeekReady={(fn) => setSeekToTime(() => fn)}
              onGetTimeReady={(fn) => setGetCurrentTime(() => fn)}
              collapsed={previewCollapsed}
              onToggleCollapse={() => setPreviewCollapsed((c) => !c)}
              showSpeakerBorders={showLaneGuides}
            />
            {!previewCollapsed && rightPanelMode !== null && (
              <StyleSidePanel
                mode={rightPanelMode}
                onClose={() => setRightPanelMode(null)}
              />
            )}
          </div>

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

              {projectId && (
                <button
                  className={`subtitles-page__save-btn${isDirty ? ' subtitles-page__save-btn--dirty' : ''}`}
                  onClick={() => void saveNow()}
                  disabled={saveStatus === 'saving'}
                  title="Save (Ctrl+S)"
                >
                  {saveStatus === 'saving' ? 'Saving...' : isDirty ? 'Save' : 'Saved'}
                </button>
              )}

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
                  onClick={() => render(resolvedJobId!)}
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
                    href={`/api/jobs/${resolvedJobId}/download`}
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

              <button
                className="subtitles-page__toolbar-btn"
                onClick={() => transcribe(resolvedJobId!, numSpeakers)}
              >
                Re-transcribe
              </button>

              <button
                className="subtitles-page__toolbar-btn"
                onClick={() => replaceVideoRef.current?.click()}
                disabled={replacingVideo}
              >
                {replacingVideo ? 'Replacing...' : 'Replace Video'}
              </button>
              <input
                ref={replaceVideoRef}
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleReplaceVideo(file)
                  e.target.value = '' // reset so same file can be re-selected
                }}
              />

              <button
                className="subtitles-page__toolbar-btn subtitles-page__toolbar-btn--muted"
                onClick={resetAll}
              >
                Upload new
              </button>

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

        {/* Bottom: stage tab bar + mini timeline (outside scroll) + editor content */}
        <div
          className="subtitles-page__bottom"
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

          {/* Mini timeline — outside scroll container so wheel events work */}
          {activeStage === 'text' && session && miniTimelineTotalDuration > 0 && (
            <MiniTimeline
              phrases={session.phrases}
              totalDuration={miniTimelineTotalDuration}
              currentTime={miniTimelineTime}
              activePhraseIndex={miniTimelineActivePhrase}
              speakerNames={speakerNames}
              waveform={waveform}
              onSeek={seekToTime ?? (() => {})}
              onAdjustStart={(phraseIndex, newStart) => {
                let globalIdx = 0
                for (let i = 0; i < phraseIndex; i++) globalIdx += session.phrases[i].words.length
                updateWord(globalIdx, { start: Math.max(0, newStart) })
              }}
              onAdjustEnd={(phraseIndex, newEnd) => {
                let globalIdx = 0
                for (let i = 0; i <= phraseIndex; i++) globalIdx += session.phrases[i].words.length
                globalIdx--
                updateWord(globalIdx, { end: Math.max(0, newEnd) })
              }}
              onShiftPhrase={shiftPhrase}
              onReassignSpeaker={reassignPhraseSpeaker}
              onHoverPhrase={setHoveredPhraseIndex}
              onEditSpeaker={(speakerId) => setRightPanelMode({ type: 'speaker', speakerId })}
            />
          )}

          <div className="subtitles-page__editor-scroll">
          <div className="subtitles-page__editor-section">
            {activeStage === 'text' && (
              <TextEditor
                seekToTime={seekToTime ?? (() => {})}
                getCurrentTime={getCurrentTime}
                hoveredPhraseIndex={hoveredPhraseIndex}
                onEditPhrase={(i) => setRightPanelMode({ type: 'phrase', phraseIndex: i })}
              />
            )}

            {activeStage === 'timing' && (
              <TimingEditor
                seekToTime={seekToTime ?? (() => {})}
                getCurrentTime={getCurrentTime}
                jobId={resolvedJobId!}
                diarizeState={diarizeState}
                onEditSpeaker={(speakerId) => setRightPanelMode({ type: 'speaker', speakerId })}
                onEditPhrase={(phraseIndex) => setRightPanelMode({ type: 'phrase', phraseIndex })}
              />
            )}

            {activeStage === 'animation' && (
              <AnimationEditor />
            )}

          </div>
          </div>{/* end editor-scroll */}

        </div>{/* end bottom */}

        <StyleDrawer mode={drawerMode} onClose={() => setDrawerMode(null)} />
        {projectId && <AutoSaveIndicator status={saveStatus} />}
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
