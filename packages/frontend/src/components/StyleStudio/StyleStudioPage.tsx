import { useCallback, useEffect, useRef, useState } from 'react'
import type { LookStyleProps } from '@eigen/remotion-composition'
import { useTextStyles } from '../../hooks/useTextStyles'
import { StyleControls } from '../StylePanel/StyleControls'
import { AutoSaveIndicator } from '../AutoSaveIndicator'
import type { SaveStatus } from '../AutoSaveIndicator'
import { createDebouncedSaver, resolveSelection, nextStyleName, STUDIO_AUTOSAVE_DELAY_MS } from '../../lib/styleLibrary'
import { DEFAULT_STYLE } from '../../store/subtitleStore'
import { pickLookProps } from '@eigen/remotion-composition'
import { StylePreview } from './StylePreview'
import { StyleLibraryList } from './StyleLibraryList'
import './StyleStudioPage.css'

interface Draft {
  id: string
  props: LookStyleProps
}

export function StyleStudioPage() {
  const { styles, loading, error, createStyle, updateStyle, deleteStyle, duplicateStyle } = useTextStyles()
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

  const runAction = async <T,>(fn: () => Promise<T>, fallback: string): Promise<T | null> => {
    try {
      setActionError(null)
      return await fn()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallback)
      return null
    }
  }

  const handleDuplicate = async (id: string) => {
    await saverRef.current.flush()
    const copy = await runAction(() => duplicateStyle(id), 'Duplicate failed')
    if (copy) setSelectedId(copy.id)
  }

  const handleCreate = async (): Promise<string | null> => {
    const created = await runAction(
      () => createStyle({ name: nextStyleName(styles.map((s) => s.name)), props: pickLookProps(DEFAULT_STYLE) }),
      'Create failed',
    )
    if (!created) return null
    handleSelect(created.id)
    return created.id
  }

  const handleRename = async (id: string, name: string) => {
    await runAction(() => updateStyle(id, { name }), 'Rename failed')
  }

  const handleDelete = async (id: string) => {
    saverRef.current.cancel(id)
    await runAction(() => deleteStyle(id), 'Delete failed')
  }

  const activeDraft = selected && draft && draft.id === selected.id ? draft : null

  return (
    <div className="style-studio-page">
      <aside className="style-studio-page__library">
        {actionError && <p className="style-studio-page__banner style-studio-page__banner--error">{actionError}</p>}
        <StyleLibraryList
          styles={styles}
          selectedId={selectedId}
          loading={loading}
          error={error}
          onSelect={handleSelect}
          onCreate={handleCreate}
          onRename={handleRename}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
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
            {selected.isBuiltin && (
              <div className="style-studio-page__banner">
                <span>Built-in style (read-only). Duplicate it to make an editable copy.</span>
                <button type="button" className="style-studio-page__banner-btn" onClick={() => void handleDuplicate(selected.id)}>
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
