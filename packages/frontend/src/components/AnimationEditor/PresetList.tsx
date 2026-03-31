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

type Category = 'entry-exit' | 'hold' | 'highlight'

const CATEGORY_LABELS: Record<Category, string> = {
  'entry-exit': 'Entry / Exit',
  'hold': 'Hold',
  'highlight': 'Highlight',
}

/** Categorize a preset by its primary animation purpose. */
function categorizePreset(preset: AnimationPreset): Category {
  // Has highlight keyframe tracks → Highlight
  if (preset.highlightAnimation && preset.highlightAnimation.enterTracks.length > 0) {
    return 'highlight'
  }
  // Has a non-none active/hold animation → Hold
  if (preset.active.type !== 'none') {
    return 'hold'
  }
  // Default: Entry/Exit
  return 'entry-exit'
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
  const [collapsedCategories, setCollapsedCategories] = useState<Set<Category>>(new Set())

  const filtered = presets.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // Group presets by category
  const grouped: Record<Category, AnimationPreset[]> = {
    'entry-exit': [],
    'hold': [],
    'highlight': [],
  }
  for (const preset of filtered) {
    grouped[categorizePreset(preset)].push(preset)
  }

  const toggleCategory = (cat: Category) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const categories: Category[] = ['entry-exit', 'hold', 'highlight']

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

        {categories.map((cat) => {
          const items = grouped[cat]
          if (items.length === 0 && search) return null // hide empty categories when searching
          const isCollapsed = collapsedCategories.has(cat)

          return (
            <div key={cat} className="preset-list__category">
              <button
                type="button"
                className="preset-list__category-header"
                onClick={() => toggleCategory(cat)}
              >
                <span className={`preset-list__category-arrow${isCollapsed ? ' preset-list__category-arrow--collapsed' : ''}`}>
                  {'\u25BE'}
                </span>
                <span className="preset-list__category-label">{CATEGORY_LABELS[cat]}</span>
                <span className="preset-list__category-count">{items.length}</span>
              </button>

              {!isCollapsed && items.map((preset) => {
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
                        &#x2398;
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
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {!isCollapsed && items.length === 0 && (
                <div className="preset-list__empty-category">No presets</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
