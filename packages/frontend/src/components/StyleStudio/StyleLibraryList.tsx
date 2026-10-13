import { useEffect, useRef, useState } from 'react'
import type { TextStyle } from '../../hooks/useTextStyles'
import './StyleLibraryList.css'

export interface StyleLibraryListProps {
  styles: TextStyle[]
  selectedId: string | null
  loading: boolean
  error: string | null
  onSelect(id: string): void
  onCreate(): Promise<string | null>
  onRename(id: string, name: string): Promise<void>
  onDuplicate(id: string): Promise<void>
  onDelete(id: string): Promise<void>
}

export function StyleLibraryList({
  styles,
  selectedId,
  loading,
  error,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
}: StyleLibraryListProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null)
  const renameCancelledRef = useRef(false)

  const builtins = styles.filter((s) => s.isBuiltin)
  const mine = styles.filter((s) => !s.isBuiltin)

  const startRename = (style: TextStyle) => {
    setConfirmDeleteId(null)
    renameCancelledRef.current = false
    setRenameValue(style.name)
    setRenamingId(style.id)
  }

  const commitRename = (style: TextStyle) => {
    if (renameCancelledRef.current) return
    renameCancelledRef.current = true // guard against the blur fired when the input unmounts
    const trimmed = renameValue.trim()
    setRenamingId(null)
    if (trimmed && trimmed !== style.name) void onRename(style.id, trimmed)
  }

  // A just-created style appears in `styles` only after the library refetches; enter rename mode then.
  useEffect(() => {
    if (!newlyCreatedId) return
    const created = styles.find((s) => s.id === newlyCreatedId)
    if (!created) return
    setNewlyCreatedId(null)
    startRename(created)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startRename only touches local state
  }, [styles, newlyCreatedId])

  const handleNew = async () => {
    const id = await onCreate()
    if (id) setNewlyCreatedId(id)
  }

  const renderRow = (style: TextStyle) => {
    const selected = style.id === selectedId
    const isRenaming = renamingId === style.id
    const isConfirming = confirmDeleteId === style.id
    return (
      <li key={style.id} className="style-library__item">
        {isRenaming ? (
          <input
            className="style-library__rename-input"
            autoFocus
            maxLength={80}
            value={renameValue}
            aria-label="Style name"
            onChange={(e) => setRenameValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => commitRename(style)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(style)
              else if (e.key === 'Escape') {
                renameCancelledRef.current = true
                setRenamingId(null)
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={'style-library__row' + (selected ? ' style-library__row--selected' : '')}
            onClick={() => onSelect(style.id)}
          >
            <span className="style-library__row-name">{style.name}</span>
            {style.isBuiltin && <span className="style-library__badge">Built-in</span>}
          </button>
        )}
        {selected && !isRenaming && !isConfirming && (
          <div className="style-library__actions">
            <button type="button" className="style-library__action" onClick={() => void onDuplicate(style.id)}>
              Duplicate
            </button>
            {!style.isBuiltin && (
              <>
                <button type="button" className="style-library__action" onClick={() => startRename(style)}>
                  Rename
                </button>
                <button
                  type="button"
                  className="style-library__action style-library__action--danger"
                  onClick={() => setConfirmDeleteId(style.id)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
        {isConfirming && (
          <div className="style-library__confirm">
            <span className="style-library__confirm-text">Delete "{style.name}"?</span>
            <div className="style-library__actions">
              <button
                type="button"
                className="style-library__action style-library__action--danger"
                onClick={() => {
                  setConfirmDeleteId(null)
                  void onDelete(style.id)
                }}
              >
                Delete
              </button>
              <button type="button" className="style-library__action" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="style-library">
      <div className="style-library__header">
        <h2 className="style-library__title">Styles</h2>
        <button type="button" className="style-library__new" onClick={() => void handleNew()}>
          New
        </button>
      </div>
      {loading && styles.length === 0 && <p className="style-library__note">Loading styles…</p>}
      {error && <p className="style-library__note style-library__note--error">Couldn't load styles: {error}</p>}
      <h3 className="style-library__section">Built-in</h3>
      <ul className="style-library__list">{builtins.map(renderRow)}</ul>
      <h3 className="style-library__section">My styles</h3>
      {mine.length === 0 ? (
        <p className="style-library__note">No styles yet. Duplicate a built-in or click New.</p>
      ) : (
        <ul className="style-library__list">{mine.map(renderRow)}</ul>
      )}
    </div>
  )
}
