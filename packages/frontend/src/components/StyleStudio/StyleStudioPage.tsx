import { useCallback, useEffect, useRef, useState } from 'react'
import type { LookStyleProps } from '@eigen/remotion-composition'
import { useTextStyles } from '../../hooks/useTextStyles'
import { StyleControls } from '../StylePanel/StyleControls'
import { AutoSaveIndicator } from '../AutoSaveIndicator'
import type { SaveStatus } from '../AutoSaveIndicator'
import { createDebouncedSaver, resolveSelection, STUDIO_AUTOSAVE_DELAY_MS } from '../../lib/styleLibrary'
import { StylePreview } from './StylePreview'
import './StyleStudioPage.css'

interface Draft {
  id: string
  props: LookStyleProps
}

export function StyleStudioPage() {
  const { styles, loading, error, updateStyle, duplicateStyle } = useTextStyles()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [actionError, setActionError] = useState<string | null>(null)

  // Hold the (stable) mutation in a ref so the saver is created exactly once.
  const updateStyleRef = useRef(updateStyle)
  updateStyleRef.current = updateStyle
  const saverRef = useRef(
    createDebouncedSaver<LookStyleProps>(
      (id, props) => updateStyleRef.current(id, { props }),
      STUDIO_AUTOSAVE_DELAY_MS,
      setSaveStatus,
    ),
  )

  // Keep the current selection if it still exists, otherwise fall back to the first style.
  // Keyed on `styles` only so a just-created id is not reset before the list refetches.
  useEffect(() => {
    setSelectedId((cur) => resolveSelection(styles, cur))
  }, [styles])

  // Load the draft from the selected style only when the selection changes. A list refetch
  // after an auto-save must never overwrite the in-progress draft of the same id.
  useEffect(() => {
    if (selectedId === null) {
      setDraft(null)
      return
    }
    if (draft?.id === selectedId) return
    const style = styles.find((s) => s.id === selectedId)
    if (style) setDraft({ id: style.id, props: style.props })
  }, [selectedId, styles, draft])

  // Flush pending edits when leaving the tab (the page unmounts on tab switch).
  useEffect(() => {
    const saver = saverRef.current
    return () => {
      void saver.flush()
    }
  }, [])

  const selected = styles.find((s) => s.id === selectedId) ?? null

  const handleSelect = useCallback((id: string) => {
    void saverRef.current.flush()
    setSelectedId(id)
  }, [])

  const handleChange = (patch: Partial<LookStyleProps>) => {
    if (!draft || !selected || selected.isBuiltin || selected.id !== draft.id) return
    const next = { ...draft.props, ...patch }
    setDraft({ id: draft.id, props: next })
    saverRef.current.schedule(draft.id, next)
  }

  const handleDuplicateBuiltin = async () => {
    if (!selected) return
    try {
      setActionError(null)
      const copy = await duplicateStyle(selected.id)
      setSelectedId(copy.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Duplicate failed')
    }
  }

  const activeDraft = selected && draft && draft.id === selected.id ? draft : null

  return (
    <div className="style-studio-page">
      <aside className="style-studio-page__library">
        <h2 className="style-studio-page__heading">Styles</h2>
        {loading && styles.length === 0 && <p className="style-studio-page__note">Loading styles…</p>}
        {error && <p className="style-studio-page__note style-studio-page__note--error">Couldn't load styles: {error}</p>}
        <ul className="style-studio-page__list">
          {styles.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={'style-studio-page__row' + (s.id === selectedId ? ' style-studio-page__row--selected' : '')}
                onClick={() => handleSelect(s.id)}
              >
                <span className="style-studio-page__row-name">{s.name}</span>
                {s.isBuiltin && <span className="style-studio-page__badge">Built-in</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="style-studio-page__preview">
        {activeDraft ? (
          <StylePreview look={activeDraft.props} />
        ) : (
          <p className="style-studio-page__note">Select a style to preview it.</p>
        )}
      </section>
      <aside className="style-studio-page__controls">
        {selected && activeDraft && (
          <>
            <div className="style-studio-page__controls-header">
              <span className="style-studio-page__style-name">{selected.name}</span>
              <AutoSaveIndicator status={saveStatus} />
            </div>
            {actionError && <p className="style-studio-page__banner style-studio-page__banner--error">{actionError}</p>}
            {selected.isBuiltin && (
              <div className="style-studio-page__banner">
                <span>Built-in style (read-only). Duplicate it to make an editable copy.</span>
                <button type="button" className="style-studio-page__banner-btn" onClick={() => void handleDuplicateBuiltin()}>
                  Duplicate
                </button>
              </div>
            )}
            <StyleControls
              value={activeDraft.props}
              onChange={handleChange}
              allowCustomFont={false}
              disabled={selected.isBuiltin}
            />
          </>
        )}
      </aside>
    </div>
  )
}
