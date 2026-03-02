import { useEffect } from 'react'
import { useUpload } from '../hooks/useUpload.ts'
import { useTranscribe } from '../hooks/useTranscribe.ts'
import { UploadZone } from '../components/UploadZone.tsx'
import { TranscriptView } from '../components/TranscriptView.tsx'
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

  const resetAll = () => {
    resetUpload()
    resetTranscribe()
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

  // State: transcribed — show video preview with karaoke subtitles + transcript below
  if (transcribeState.status === 'transcribed' && transcribeState.transcript) {
    return (
      <div className="subtitles-page subtitles-page--preview">
        <PreviewPanel />

        <div className="subtitles-page__transcript-section">
          <TranscriptView transcript={transcribeState.transcript} />
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
    )
  }

  // State: ready — show video info and enabled Transcribe button
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
