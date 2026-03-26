import { useState } from 'react'
import type { AnimationPreset } from '@eigen/shared-types'
import './PresetList.css'

interface PresetListProps {
  presets: AnimationPreset[]
  selectedId: string | null
  activeGlobalId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export function PresetList({
  presets,
  selectedId,
  activeGlobalId,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
}: PresetListProps) {
  const [search, setSearch] = useState('')

  const filtered = presets.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="preset-list">
      <div className="preset-list__header">
        <input
          className="preset-list__search"
          type="text"
          placeholder="Search presets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="preset-list__new-btn"
          type="button"
          onClick={onCreate}
          title="New preset"
        >
          +
        </button>
      </div>

      <div className="preset-list__items">
        {filtered.length === 0 && (
          <div className="preset-list__empty">No presets found</div>
        )}
        {filtered.map((preset) => {
          const isSelected = preset.id === selectedId
          const isActive = preset.id === activeGlobalId

          return (
            <div
              key={preset.id}
              className={[
                'preset-list__item',
                isSelected ? 'preset-list__item--selected' : '',
              ].join(' ').trim()}
              onClick={() => onSelect(preset.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(preset.id)
              }}
            >
              <div className="preset-list__item-main">
                {isActive && (
                  <span
                    className="preset-list__active-dot"
                    title="Global default"
                    aria-label="Active global preset"
                  />
                )}
                <span className="preset-list__item-name">{preset.name}</span>
                <span className="preset-list__scope-badge">
                  {preset.scope === 'word' ? 'Word' : 'Phrase'}
                </span>
                {preset.isBuiltin && (
                  <span className="preset-list__builtin-badge">Built-in</span>
                )}
              </div>
              <div className="preset-list__item-actions">
                <button
                  className="preset-list__action-btn"
                  type="button"
                  title="Duplicate"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicate(preset.id)
                  }}
                >
                  ⎘
                </button>
                {!preset.isBuiltin && (
                  <button
                    className="preset-list__action-btn preset-list__action-btn--delete"
                    type="button"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(preset.id)
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
