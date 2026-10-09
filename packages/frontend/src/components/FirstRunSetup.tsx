import { useEffect, useState } from 'react'
import type { SetupStatus } from '../hooks/useSetup'
import './DeleteConfirmDialog.css'
import './FirstRunSetup.css'

interface FirstRunSetupProps {
  status: Exclude<SetupStatus, 'checking' | 'ready'>
  /** 0-100 while downloading; null while installing (indeterminate) */
  progress: number | null
  phaseLabel: string
  error: string | null
  onStart: () => void
  onCancel: () => void
}

/** Strip trailing punctuation so "{reason}." never renders as "reason.." */
function formatReason(reason: string | null): string {
  const text = (reason ?? 'Unknown error').trim().replace(/[.\s]+$/, '')
  return text || 'Unknown error'
}

export function FirstRunSetup({ status, progress, phaseLabel, error, onStart, onCancel }: FirstRunSetupProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  // Close the confirmation if the run ended underneath it (finished, failed or cancelled)
  useEffect(() => {
    if (status !== 'running') setConfirmingCancel(false)
  }, [status])

  useEffect(() => {
    if (!confirmingCancel) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmingCancel(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [confirmingCancel])

  const indeterminate = progress === null
  const fillWidth = indeterminate ? 100 : Math.max(0, Math.min(100, progress))

  return (
    <div className="first-run-setup">
      <div className="first-run-setup__card">
        <div className="first-run-setup__header">
          <h2>First-Time Setup</h2>
        </div>

        <div className="first-run-setup__body">
          {status === 'needed' && (
            <p className="first-run-setup__text">
              Eigen needs to download a Python environment (~5-6GB) to run transcription and diarization. This
              happens once.
            </p>
          )}

          {status === 'running' && (
            <div className="first-run-setup__progress">
              <p className="first-run-setup__status-label">{phaseLabel}</p>
              <div
                className="first-run-setup__progress-track subtitles-page__progress-track"
                role="progressbar"
                aria-label="Environment setup progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={indeterminate ? undefined : fillWidth}
              >
                <div
                  className={
                    'subtitles-page__progress-fill' +
                    (indeterminate ? ' first-run-setup__progress-fill--indeterminate' : '')
                  }
                  style={indeterminate ? undefined : { width: `${fillWidth}%` }}
                />
              </div>
            </div>
          )}

          {status === 'error' && (
            <p className="first-run-setup__error" role="alert">
              Setup failed: {formatReason(error)}. Check your internet connection and available disk space.
            </p>
          )}
        </div>

        <div className="first-run-setup__footer">
          {status === 'needed' && (
            <button className="first-run-setup__btn first-run-setup__btn--primary" onClick={onStart} autoFocus>
              Set Up Environment
            </button>
          )}
          {status === 'running' && (
            <button
              className="first-run-setup__btn first-run-setup__btn--secondary"
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel
            </button>
          )}
          {status === 'error' && (
            <button className="first-run-setup__btn first-run-setup__btn--primary" onClick={onStart} autoFocus>
              Retry Setup
            </button>
          )}
        </div>
      </div>

      {confirmingCancel && (
        <div className="delete-confirm-backdrop" onClick={() => setConfirmingCancel(false)}>
          <div
            className="delete-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-run-setup-cancel-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-confirm-dialog__header">
              <h3 id="first-run-setup-cancel-title">Cancel Setup?</h3>
            </div>
            <div className="delete-confirm-dialog__body">
              <p>This will discard the partial download. You can restart setup later.</p>
            </div>
            <div className="delete-confirm-dialog__footer">
              <button
                className="delete-confirm-dialog__btn delete-confirm-dialog__btn--secondary"
                onClick={() => setConfirmingCancel(false)}
              >
                Continue Setup
              </button>
              <button
                className="delete-confirm-dialog__btn delete-confirm-dialog__btn--danger"
                onClick={() => {
                  setConfirmingCancel(false)
                  onCancel()
                }}
              >
                Cancel Setup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
