import { useEffect, useRef, useState } from 'react'
import {
  loadSettings,
  saveSettings,
  SettingsValidationError,
  type AppSettingsView,
  type SettingsUpdate,
} from '../lib/settingsPrefs.ts'
import './SettingsDialog.css'

interface SettingsDialogProps {
  onClose: () => void
}

/**
 * Settings modal (D-09, D-11): HuggingFace token (masked, write-only) and media storage location
 * (native folder picker via the Electron preload bridge). Same chrome as
 * TranscriptionOptionsDialog. Enter saves, Escape cancels.
 */
export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [current, setCurrent] = useState<AppSettingsView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [pendingMediaRoot, setPendingMediaRoot] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const tokenInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    loadSettings()
      .then((s) => {
        if (!cancelled) setCurrent(s)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load settings from the backend.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    tokenInputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const chooseFolder = async () => {
    if (!window.eigen?.chooseFolder) return
    const picked = await window.eigen.chooseFolder()
    if (picked) {
      setPendingMediaRoot(picked)
      setFolderError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || !current) return

    // Blank token = leave unchanged (the saved token is never sent back to the client)
    const update: SettingsUpdate = {}
    if (token.trim() !== '') update.hfToken = token.trim()
    if (pendingMediaRoot !== null) update.mediaRoot = pendingMediaRoot
    if (Object.keys(update).length === 0) {
      onClose()
      return
    }

    setSaving(true)
    setTokenError(null)
    setFolderError(null)
    try {
      await saveSettings(update)
      onClose()
    } catch (err) {
      if (err instanceof SettingsValidationError) {
        if (err.field === 'hfToken') setTokenError(err.message)
        else if (err.field === 'mediaRoot') setFolderError(err.message)
        else setLoadError(err.message)
      } else {
        setLoadError('Could not save settings. Check that the backend is running and try again.')
      }
      setSaving(false)
    }
  }

  const shownMediaRoot = pendingMediaRoot ?? current?.mediaRoot ?? ''
  const restartNeeded =
    current !== null && shownMediaRoot !== '' && shownMediaRoot !== current.activeMediaRoot
  const canChooseFolder = typeof window !== 'undefined' && Boolean(window.eigen?.chooseFolder)

  return (
    <div className="settings-dialog-backdrop" onClick={onClose}>
      <form
        className="settings-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="settings-dialog__header">
          <h3>Settings</h3>
        </div>
        <div className="settings-dialog__body">
          <label className="settings-dialog__field">
            <span>HuggingFace Access Token</span>
            <input
              ref={tokenInputRef}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={current?.hasToken ? 'Saved — leave blank to keep' : 'hf_…'}
              value={token}
              onChange={(e) => {
                setToken(e.target.value)
                setTokenError(null)
              }}
            />
          </label>
          <p className="settings-dialog__hint">
            Required for speaker detection. Get a token at huggingface.co/settings/tokens.
          </p>
          {tokenError && <p className="settings-dialog__error">{tokenError}</p>}

          <div className="settings-dialog__field settings-dialog__field--stacked">
            <span>Media Storage Location</span>
            <div className="settings-dialog__path-row">
              <span className="settings-dialog__path" title={shownMediaRoot}>
                {shownMediaRoot || '…'}
              </span>
              <button
                type="button"
                className="settings-dialog__btn settings-dialog__btn--secondary"
                onClick={() => void chooseFolder()}
                disabled={!canChooseFolder}
                title={canChooseFolder ? undefined : 'Folder picker is only available in the desktop app'}
              >
                Choose Folder…
              </button>
            </div>
          </div>
          {restartNeeded && (
            <p className="settings-dialog__hint">
              Takes effect the next time the app starts. Existing projects stay where they are.
            </p>
          )}
          {folderError && <p className="settings-dialog__error">{folderError}</p>}
          {loadError && <p className="settings-dialog__error">{loadError}</p>}
        </div>
        <div className="settings-dialog__footer">
          <button
            type="button"
            className="settings-dialog__btn settings-dialog__btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="settings-dialog__btn settings-dialog__btn--primary"
            disabled={saving || current === null}
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  )
}
