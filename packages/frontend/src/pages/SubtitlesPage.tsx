import { useCallback, useEffect, useRef, useState } from 'react'
import { useUpload } from '../hooks/useUpload.ts'
import { useTranscribe } from '../hooks/useTranscribe.ts'
import { useDiarize } from '../hooks/useDiarize.ts'
import { useRender } from '../hooks/useRender.ts'
import { UploadZone } from '../components/UploadZone.tsx'
import { TranscriptEditor } from '../components/TranscriptEditor/TranscriptEditor.tsx'
import { StylePanel } from '../components/StylePanel/StylePanel.tsx'
import { SpeakerStylePanel } from '../components/StylePanel/SpeakerStylePanel.tsx'
import { PreviewPanel } from '../components/PreviewPanel.tsx'
import { useSubtitleStore } from '../store/subtitleStore.ts'
import './SubtitlesPage.css'

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
  const [activeTab, setActiveTab] = useState<'transcript' | 'style'>('transcript')
  const containerRef = useRef<HTMLDivElement>(null)

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

  const resetAll = () => {
    resetUpload()
    resetTranscribe()
    resetDiarize()
    resetRender()
    useSubtitleStore.getState().reset()
  }

  // Push job data into Zustand store when transcription completes so PreviewPanel can consume it
  useEffect(() => {
    if (transcribeState.status !== 'transcribed') return
    const jobId = uploadState.jobId
    const transcript = transcribeState.transcript
    const metadata = uploadState.job?.metadata
    if (!jobId || !transcript || !metadata) return
    useSubtitleStore.getState().setJob(jobId, transcript, metadata)
  }, [transcribeState.status, uploadState.jobId, transcribeState.transcript, uploadState.job])

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

  // State: transcribed — show video preview with karaoke subtitles + transcript editor below
  if (transcribeState.status === 'transcribed' && transcribeState.transcript) {
    return (
      <div className="subtitles-page subtitles-page--preview" ref={containerRef}>
        <div className="subtitles-page__top" style={{ height: `${topPercent}%` }}>
          <PreviewPanel
            onSeekReady={(fn) => setSeekToTime(() => fn)}
            onGetTimeReady={(fn) => setGetCurrentTime(() => fn)}
          />

          <div className="subtitles-page__top-controls">
            <button
              className="subtitles-page__goto-btn"
              onClick={handleGoToSubtitle}
            >
              Go to subtitle
            </button>

            <div className="subtitles-page__diarize-controls">
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
                  ? `Detecting speakers... ${diarizeState.progress}%`
                  : diarizeState.status === 'done'
                    ? 'Re-detect speakers'
                    : 'Detect speakers'}
              </button>
            </div>

            {diarizeState.status === 'failed' && diarizeState.error && (
              <p className="subtitles-page__diarize-error">{diarizeState.error}</p>
            )}

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
        </div>

        <div className="subtitles-page__resize-handle" onMouseDown={handleResizeMouseDown}>
          <div className="subtitles-page__resize-grip" />
        </div>

        <div className="subtitles-page__editor-scroll" style={{ height: `${100 - topPercent}%` }}>
          {/* Tab bar */}
          <div className="subtitles-page__tab-bar">
            <button
              className={`subtitles-page__tab${activeTab === 'transcript' ? ' subtitles-page__tab--active' : ''}`}
              onClick={() => setActiveTab('transcript')}
              type="button"
            >
              Transcript
            </button>
            <button
              className={`subtitles-page__tab${activeTab === 'style' ? ' subtitles-page__tab--active' : ''}`}
              onClick={() => setActiveTab('style')}
              type="button"
            >
              Style
            </button>
          </div>

          <div className="subtitles-page__editor-section">
            {activeTab === 'transcript' ? (
              <TranscriptEditor seekToTime={seekToTime ?? (() => {})} />
            ) : (
              <div className="subtitles-page__style-panels">
                <StylePanel />
                <SpeakerStylePanel />
              </div>
            )}
          </div>

          <button
            className="subtitles-page__transcribe-btn subtitles-page__transcribe-btn--narrow"
            onClick={() => transcribe(uploadState.jobId!)}
          >
            Re-transcribe
          </button>

          <button className="subtitles-page__reset-btn" onClick={resetAll}>
            Upload another video
          </button>
        </div>
      </div>
    )
  }

  // State: ready — show video info, video preview, and enabled Transcribe button
  const { job, jobId } = uploadState
  const meta = job?.metadata

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
          {meta && (
            <dl className="subtitles-page__meta-list">
              <div className="subtitles-page__meta-row">
                <dt>Duration</dt>
                <dd>{formatDuration(meta.duration)}</dd>
              </div>
              <div className="subtitles-page__meta-row">
                <dt>Resolution</dt>
                <dd>{meta.width}&times;{meta.height}</dd>
              </div>
              <div className="subtitles-page__meta-row">
                <dt>Frame rate</dt>
                <dd>{meta.fps} fps</dd>
              </div>
            </dl>
          )}
        </div>

        <button
          className="subtitles-page__transcribe-btn"
          onClick={() => transcribe(jobId!)}
        >
          Transcribe
        </button>

        <button className="subtitles-page__reset-btn" onClick={resetAll}>
          Upload another video
        </button>
      </div>
    </div>
  )
}
