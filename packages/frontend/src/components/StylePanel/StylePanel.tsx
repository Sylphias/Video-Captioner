import { useState, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { pickLookProps } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import { StyleControls, ScrubInput } from './StyleControls.tsx'
import { StylePicker } from '../StylePicker/StylePicker.tsx'
import { applyLookStyle, buildSaveAsStylePayload } from '../../lib/applyStyle.ts'
import { useTextStyles } from '../../hooks/useTextStyles.ts'
import './StylePanel.css'

/**
 * Session "max chars per line" control. Mirrors the transcription-options
 * dialog value for this session (seeded at setJob, persisted in the project
 * blob). Commits on blur/Enter rather than per keystroke because each commit
 * regroups all phrases and pushes an undo snapshot. Blank = off — old
 * projects load with the cap off and stay untouched until a value is set.
 */
function MaxCharsPerLineControl() {
  const maxCharsPerPhrase = useSubtitleStore((s) => s.maxCharsPerPhrase)
  const setMaxCharsPerPhrase = useSubtitleStore((s) => s.setMaxCharsPerPhrase)
  const [draft, setDraft] = useState(maxCharsPerPhrase === null ? '' : String(maxCharsPerPhrase))

  // Sync draft when the store value changes externally (undo/redo, project load)
  useEffect(() => {
    setDraft(maxCharsPerPhrase === null ? '' : String(maxCharsPerPhrase))
  }, [maxCharsPerPhrase])

  const commit = () => {
    const n = draft.trim() === '' ? NaN : Number(draft)
    const next = Number.isFinite(n) && n > 0 ? Math.round(n) : null
    setMaxCharsPerPhrase(next)
    setDraft(next === null ? '' : String(next))
  }

  return (
    <div className="style-panel__section">
      <label
        className="style-panel__label"
        title="Regroups phrases so no line exceeds this many characters. Takes priority over the word cap. Blank = off."
      >
        Max chars per line
      </label>
      <div className="style-panel__inline-row">
        <input
          type="number"
          className="style-panel__chars-input"
          min={8}
          max={200}
          placeholder="Off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
      </div>
    </div>
  )
}

export function StylePanel() {
  // One shallow-compared look slice: re-renders only when a look field changes
  const look = useSubtitleStore(useShallow((s) => pickLookProps(s.style)))
  const verticalPosition = useSubtitleStore((s) => s.style.verticalPosition)
  const laneGap = useSubtitleStore((s) => s.style.laneGap)
  const lingerDuration = useSubtitleStore((s) => s.style.lingerDuration)
  const maxWordsPerPhrase = useSubtitleStore((s) => s.maxWordsPerPhrase)
  const setStyle = useSubtitleStore((s) => s.setStyle)
  const setMaxWordsPerPhrase = useSubtitleStore((s) => s.setMaxWordsPerPhrase)
  const { createStyle } = useTextStyles()

  // "Save as style" inline form (no native prompt)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [saveAsName, setSaveAsName] = useState('My style')
  const [saveAsBusy, setSaveAsBusy] = useState(false)
  const [saveAsError, setSaveAsError] = useState<string | null>(null)
  const [saveAsNotice, setSaveAsNotice] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (noticeTimer.current !== null) clearTimeout(noticeTimer.current)
  }, [])

  const closeSaveAs = () => {
    setSaveAsOpen(false)
    setSaveAsError(null)
  }

  const submitSaveAs = async () => {
    // Read the store at submit time so the saved look is what the project has now
    const payload = buildSaveAsStylePayload(saveAsName, useSubtitleStore.getState().style)
    if (!payload.name) {
      setSaveAsError('Enter a name')
      return
    }
    setSaveAsBusy(true)
    setSaveAsError(null)
    try {
      await createStyle(payload)
      setSaveAsOpen(false)
      setSaveAsNotice(`Saved "${payload.name}" to Style Studio`)
      if (noticeTimer.current !== null) clearTimeout(noticeTimer.current)
      noticeTimer.current = setTimeout(() => setSaveAsNotice(null), 3000)
    } catch (err) {
      setSaveAsError(err instanceof Error ? err.message : 'Failed to save style')
    } finally {
      setSaveAsBusy(false)
    }
  }

  return (
    <div className="style-panel">
      {/* Library: copy a saved style's look into this project (D-09/D-10) */}
      <div className="style-panel__library-row">
        <StylePicker onApply={(props) => applyLookStyle({ level: 'global' }, props)} />
        <button
          type="button"
          className="style-panel__save-as-btn"
          onClick={() => {
            setSaveAsName('My style')
            setSaveAsError(null)
            setSaveAsOpen((o) => !o)
          }}
        >
          Save as style
        </button>
      </div>
      {saveAsOpen && (
        <form
          className="style-panel__save-as-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submitSaveAs()
          }}
        >
          <input
            type="text"
            className="style-panel__save-as-input"
            aria-label="Style name"
            maxLength={80}
            autoFocus
            value={saveAsName}
            disabled={saveAsBusy}
            onChange={(e) => setSaveAsName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') closeSaveAs() }}
          />
          <button type="submit" className="style-panel__save-as-btn" disabled={saveAsBusy}>
            {saveAsBusy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="style-panel__save-as-btn" onClick={closeSaveAs} disabled={saveAsBusy}>
            Cancel
          </button>
        </form>
      )}
      {saveAsError && <p className="style-panel__save-as-error">{saveAsError}</p>}
      {saveAsNotice && <p className="style-panel__save-as-notice">{saveAsNotice}</p>}

      {/* Look controls (shared with the Style Studio). One onChange = one setStyle = one undo step. */}
      <StyleControls value={look} onChange={setStyle} />

      {/* Max words per phrase */}
      <div className="style-panel__section">
        <label className="style-panel__label">Words per phrase</label>
        <div className="style-panel__inline-row">
          <ScrubInput
            value={maxWordsPerPhrase}
            min={1}
            max={12}
            step={1}
            onChange={(v) => setMaxWordsPerPhrase(v)}
          />
        </div>
      </div>

      {/* Max chars per line (session value; participates in regrouping) */}
      <MaxCharsPerLineControl />

      {/* Vertical position slider */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Vertical position <span className="style-panel__value">{verticalPosition}% from top</span>
        </label>
        <input
          type="range"
          className="style-panel__slider"
          min={5}
          max={95}
          step={1}
          value={verticalPosition}
          onChange={(e) => setStyle({ verticalPosition: Number(e.target.value) })}
        />
      </div>

      {/* Lane gap slider — spacing between overlapping speaker lanes */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Speaker lane gap <span className="style-panel__value">{laneGap}%</span>
        </label>
        <input
          type="range"
          className="style-panel__slider"
          min={0}
          max={25}
          step={1}
          value={laneGap}
          onChange={(e) => setStyle({ laneGap: Number(e.target.value) })}
        />
      </div>

      {/* Linger duration slider */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Linger duration <span className="style-panel__value">{lingerDuration.toFixed(1)}s</span>
        </label>
        <input
          type="range"
          className="style-panel__slider"
          min={0}
          max={3}
          step={0.1}
          value={lingerDuration}
          onChange={(e) => setStyle({ lingerDuration: Number(e.target.value) })}
        />
      </div>

    </div>
  )
}
