import { useUpload } from '../hooks/useUpload.ts'
import { UploadZone } from '../components/UploadZone.tsx'
import './SubtitlesPage.css'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function SubtitlesPage() {
  const { state, upload, reset } = useUpload()

  // State: idle — show upload zone
  if (state.status === 'idle') {
    return (
      <div className="subtitles-page subtitles-page--centered">
        <UploadZone onFile={upload} />
      </div>
    )
  }

  // State: uploading or normalizing — show progress
  if (state.status === 'uploading' || state.status === 'normalizing') {
    const label =
      state.status === 'uploading'
        ? `Uploading... ${state.progress}%`
        : `Normalizing video... ${state.progress}%`

    return (
      <div className="subtitles-page subtitles-page--centered">
        <div className="subtitles-page__progress-card">
          {state.job?.originalFilename && (
            <p className="subtitles-page__filename">{state.job.originalFilename}</p>
          )}
          <p className="subtitles-page__status-label">{label}</p>
          <div className="subtitles-page__progress-track">
            <div
              className="subtitles-page__progress-fill"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // State: failed — show error
  if (state.status === 'failed') {
    return (
      <div className="subtitles-page subtitles-page--centered">
        <div className="subtitles-page__error-card">
          <p className="subtitles-page__error-message">
            {state.error ?? 'An unexpected error occurred'}
          </p>
          <button className="subtitles-page__retry-btn" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  // State: ready — show video info and Transcribe button
  const { job, jobId } = state
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

        <button className="subtitles-page__transcribe-btn" disabled>
          Transcribe
        </button>

        <button className="subtitles-page__reset-btn" onClick={reset}>
          Upload another video
        </button>
      </div>
    </div>
  )
}
