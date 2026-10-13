import { useEffect, useState } from 'react'
import { useTextStyles } from '../../hooks/useTextStyles'
import { StyleControls } from '../StylePanel/StyleControls'
import { StylePreview } from './StylePreview'
import './StyleStudioPage.css'

const noop = () => {}

export function StyleStudioPage() {
  const { styles, loading, error } = useTextStyles()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Keep the current selection if it still exists, otherwise fall back to the first style.
  // Keyed on `styles` only so a just-created id is not reset before the list refetches.
  useEffect(() => {
    setSelectedId((cur) => {
      if (cur && styles.some((s) => s.id === cur)) return cur
      return styles.length > 0 ? styles[0].id : null
    })
  }, [styles])

  const selected = styles.find((s) => s.id === selectedId) ?? null

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
                onClick={() => setSelectedId(s.id)}
              >
                <span className="style-studio-page__row-name">{s.name}</span>
                {s.isBuiltin && <span className="style-studio-page__badge">Built-in</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="style-studio-page__preview">
        {selected ? (
          <StylePreview look={selected.props} />
        ) : (
          <p className="style-studio-page__note">Select a style to preview it.</p>
        )}
      </section>
      <aside className="style-studio-page__controls">
        {selected && (
          <>
            <div className="style-studio-page__controls-header">
              <span className="style-studio-page__style-name">{selected.name}</span>
            </div>
            <StyleControls value={selected.props} onChange={noop} allowCustomFont={false} disabled />
          </>
        )}
      </aside>
    </div>
  )
}
