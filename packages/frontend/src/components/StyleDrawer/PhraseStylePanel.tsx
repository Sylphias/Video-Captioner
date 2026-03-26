import { HexColorPicker, HexColorInput } from 'react-colorful'
import { FONT_NAMES, getFontFamily } from '@eigen/remotion-composition'
import { useSubtitleStore, type PhraseStyleOverride } from '../../store/subtitleStore.ts'
import { useAnimationPresets } from '../../hooks/useAnimationPresets.ts'
import '../StylePanel/SpeakerStylePanel.css'

type StyleField = keyof PhraseStyleOverride

interface PhraseStylePanelProps {
  phraseIndex: number
}

export function PhraseStylePanel({ phraseIndex }: PhraseStylePanelProps) {
  const phrase = useSubtitleStore((s) => s.session?.phrases[phraseIndex])
  const setPhraseStyle = useSubtitleStore((s) => s.setPhraseStyle)
  const clearPhraseStyle = useSubtitleStore((s) => s.clearPhraseStyle)
  const phraseAnimationPresetIds = useSubtitleStore((s) => s.phraseAnimationPresetIds)
  const setPhraseAnimationPresetId = useSubtitleStore((s) => s.setPhraseAnimationPresetId)
  const activePresetId = useSubtitleStore((s) => s.activeAnimationPresetId)
  const { presets } = useAnimationPresets()

  if (!phrase) return null

  const override = (phrase.styleOverride ?? {}) as PhraseStyleOverride
  const phraseText = phrase.words.map((w) => w.word).join(' ')

  // Current per-phrase animation override (if any)
  const phrasePresetId = phraseAnimationPresetIds[phraseIndex] ?? null

  const setField = (field: StyleField, value: string | number) => {
    setPhraseStyle(phraseIndex, { [field]: value } as PhraseStyleOverride)
  }

  const toggleField = (field: StyleField, checked: boolean) => {
    if (!checked) {
      const next = { ...override }
      delete next[field]
      // Replace entire override (clear + set remaining)
      clearPhraseStyle(phraseIndex)
      if (Object.keys(next).length > 0) {
        setPhraseStyle(phraseIndex, next)
      }
    }
  }

  const hasOverride = (field: StyleField) => field in override

  return (
    <div className="speaker-style-panel">
      {/* Phrase preview text */}
      <p className="speaker-style-panel__heading" style={{ fontStyle: 'italic', opacity: 0.8 }}>
        &ldquo;{phraseText}&rdquo;
      </p>

      <div className="speaker-section">
        <div className="speaker-section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {/* Animation preset override */}
          <div className="speaker-section__control-row">
            <label className="speaker-section__field-label">Animation Preset</label>
            <select
              className="speaker-section__select"
              value={phrasePresetId ?? ''}
              onChange={(e) => {
                const val = e.target.value
                setPhraseAnimationPresetId(phraseIndex, val || null)
              }}
            >
              <option value="">
                {activePresetId
                  ? `Use global default (${presets.find((p) => p.id === activePresetId)?.name ?? 'Unknown'})`
                  : 'Use global default (None)'}
              </option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.isBuiltin ? ' (built-in)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Font family override */}
          <div className="speaker-section__control-row">
            <label className="speaker-section__toggle-label">
              <input
                type="checkbox"
                checked={hasOverride('fontFamily')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setField('fontFamily', getFontFamily(FONT_NAMES[0]))
                  } else {
                    toggleField('fontFamily', false)
                  }
                }}
              />
              Override font
            </label>
            {hasOverride('fontFamily') && (
              <select
                className="speaker-section__select"
                value={override.fontFamily ?? ''}
                style={{ fontFamily: override.fontFamily }}
                onChange={(e) => setField('fontFamily', e.target.value)}
              >
                {FONT_NAMES.map((name) => {
                  const family = getFontFamily(name)
                  return (
                    <option key={name} value={family} style={{ fontFamily: family }}>
                      {name}
                    </option>
                  )
                })}
              </select>
            )}
          </div>

          {/* Font size override */}
          <div className="speaker-section__control-row">
            <label className="speaker-section__toggle-label">
              <input
                type="checkbox"
                checked={hasOverride('fontSize')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setField('fontSize', 48)
                  } else {
                    toggleField('fontSize', false)
                  }
                }}
              />
              Override font size
              {hasOverride('fontSize') && (
                <span className="speaker-section__value">{override.fontSize}px</span>
              )}
            </label>
            {hasOverride('fontSize') && (
              <input
                type="range"
                className="speaker-section__slider"
                min={16}
                max={96}
                step={2}
                value={override.fontSize ?? 48}
                onChange={(e) => setField('fontSize', Number(e.target.value))}
              />
            )}
          </div>

          {/* Highlight color override */}
          <div className="speaker-section__control-row">
            <label className="speaker-section__toggle-label">
              <input
                type="checkbox"
                checked={hasOverride('highlightColor')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setField('highlightColor', '#FFFF00')
                  } else {
                    toggleField('highlightColor', false)
                  }
                }}
              />
              Override highlight color
            </label>
            {hasOverride('highlightColor') && (
              <div className="speaker-section__color-control">
                <HexColorPicker
                  color={override.highlightColor ?? '#FFFF00'}
                  onChange={(c) => setField('highlightColor', c)}
                />
                <div className="speaker-section__hex-row">
                  <span className="speaker-section__hex-prefix">#</span>
                  <HexColorInput
                    className="speaker-section__hex-input"
                    color={override.highlightColor ?? '#FFFF00'}
                    onChange={(c) => setField('highlightColor', c)}
                    prefixed={false}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Base color override */}
          <div className="speaker-section__control-row">
            <label className="speaker-section__toggle-label">
              <input
                type="checkbox"
                checked={hasOverride('baseColor')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setField('baseColor', '#FFFFFF')
                  } else {
                    toggleField('baseColor', false)
                  }
                }}
              />
              Override base color
            </label>
            {hasOverride('baseColor') && (
              <div className="speaker-section__color-control">
                <HexColorPicker
                  color={override.baseColor ?? '#FFFFFF'}
                  onChange={(c) => setField('baseColor', c)}
                />
                <div className="speaker-section__hex-row">
                  <span className="speaker-section__hex-prefix">#</span>
                  <HexColorInput
                    className="speaker-section__hex-input"
                    color={override.baseColor ?? '#FFFFFF'}
                    onChange={(c) => setField('baseColor', c)}
                    prefixed={false}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stroke width override */}
          <div className="speaker-section__control-row">
            <label className="speaker-section__toggle-label">
              <input
                type="checkbox"
                checked={hasOverride('strokeWidth')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setField('strokeWidth', 2)
                  } else {
                    toggleField('strokeWidth', false)
                  }
                }}
              />
              Override stroke width
              {hasOverride('strokeWidth') && (
                <span className="speaker-section__value">{override.strokeWidth}px</span>
              )}
            </label>
            {hasOverride('strokeWidth') && (
              <input
                type="range"
                className="speaker-section__slider"
                min={0}
                max={4}
                step={0.5}
                value={override.strokeWidth ?? 2}
                onChange={(e) => setField('strokeWidth', Number(e.target.value))}
              />
            )}
          </div>

          {/* Stroke color override */}
          {hasOverride('strokeWidth') && (override.strokeWidth ?? 0) > 0 && (
            <div className="speaker-section__control-row">
              <label className="speaker-section__toggle-label">
                <input
                  type="checkbox"
                  checked={hasOverride('strokeColor')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setField('strokeColor', '#000000')
                    } else {
                      toggleField('strokeColor', false)
                    }
                  }}
                />
                Override stroke color
              </label>
              {hasOverride('strokeColor') && (
                <div className="speaker-section__color-control">
                  <HexColorPicker
                    color={override.strokeColor ?? '#000000'}
                    onChange={(c) => setField('strokeColor', c)}
                  />
                  <div className="speaker-section__hex-row">
                    <span className="speaker-section__hex-prefix">#</span>
                    <HexColorInput
                      className="speaker-section__hex-input"
                      color={override.strokeColor ?? '#000000'}
                      onChange={(c) => setField('strokeColor', c)}
                      prefixed={false}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vertical position override */}
          <div className="speaker-section__control-row">
            <label className="speaker-section__toggle-label">
              <input
                type="checkbox"
                checked={hasOverride('verticalPosition')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setField('verticalPosition', 80)
                  } else {
                    toggleField('verticalPosition', false)
                  }
                }}
              />
              Override vertical position
              {hasOverride('verticalPosition') && (
                <span className="speaker-section__value">{override.verticalPosition}%</span>
              )}
            </label>
            {hasOverride('verticalPosition') && (
              <input
                type="range"
                className="speaker-section__slider"
                min={5}
                max={95}
                step={1}
                value={override.verticalPosition ?? 80}
                onChange={(e) => setField('verticalPosition', Number(e.target.value))}
              />
            )}
          </div>

          {/* Clear all overrides */}
          <button
            className="speaker-section__clear-btn"
            onClick={() => clearPhraseStyle(phraseIndex)}
            type="button"
          >
            Clear all overrides
          </button>
        </div>
      </div>
    </div>
  )
}
