import { useEffect, useRef, useState } from 'react'
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
  const globalStyle = useSubtitleStore((s) => s.style)
  const setPhraseStyle = useSubtitleStore((s) => s.setPhraseStyle)
  const clearPhraseStyle = useSubtitleStore((s) => s.clearPhraseStyle)
  const setPhraseTiming = useSubtitleStore((s) => s.setPhraseTiming)
  const phraseAnimationPresetIds = useSubtitleStore((s) => s.phraseAnimationPresetIds)
  const setPhraseAnimationPresetId = useSubtitleStore((s) => s.setPhraseAnimationPresetId)
  const activePresetId = useSubtitleStore((s) => s.activeAnimationPresetId)
  const { presets } = useAnimationPresets()

  // Timing inputs: local text state so typing isn't fought by the store's
  // rescaled/clamped value re-rendering on every keystroke — committed on
  // blur/Enter, same "type then commit" pattern as the Time Shift toolbar control.
  const phraseStart = phrase && phrase.words.length > 0 ? phrase.words[0].start : 0
  const phraseEnd = phrase && phrase.words.length > 0 ? phrase.words[phrase.words.length - 1].end : 0
  const [startText, setStartText] = useState(phraseStart.toFixed(2))
  const [endText, setEndText] = useState(phraseEnd.toFixed(2))
  const startFocusedRef = useRef(false)
  const endFocusedRef = useRef(false)

  useEffect(() => {
    if (!startFocusedRef.current) setStartText(phraseStart.toFixed(2))
  }, [phraseStart])
  useEffect(() => {
    if (!endFocusedRef.current) setEndText(phraseEnd.toFixed(2))
  }, [phraseEnd])

  if (!phrase) return null

  const commitStart = () => {
    const val = parseFloat(startText)
    if (!isNaN(val)) {
      setPhraseTiming(phraseIndex, Math.max(0, val), phraseEnd)
    } else {
      setStartText(phraseStart.toFixed(2))
    }
  }
  const commitEnd = () => {
    const val = parseFloat(endText)
    if (!isNaN(val)) {
      setPhraseTiming(phraseIndex, phraseStart, Math.max(0, val))
    } else {
      setEndText(phraseEnd.toFixed(2))
    }
  }

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

      {/* Phrase start/end timing */}
      <div className="speaker-section">
        <div className="speaker-section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div className="speaker-section__control-row">
            <label className="speaker-section__field-label">Timing</label>
            <div className="phrase-timing-row">
              <label className="phrase-timing-field">
                <span>Start</span>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  value={startText}
                  onFocus={() => { startFocusedRef.current = true }}
                  onChange={(e) => setStartText(e.target.value)}
                  onBlur={() => { startFocusedRef.current = false; commitStart() }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                />
              </label>
              <label className="phrase-timing-field">
                <span>End</span>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  value={endText}
                  onFocus={() => { endFocusedRef.current = true }}
                  onChange={(e) => setEndText(e.target.value)}
                  onBlur={() => { endFocusedRef.current = false; commitEnd() }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                />
              </label>
              <span className="phrase-timing-unit">sec</span>
            </div>
          </div>
        </div>
      </div>

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
                    setField('fontFamily', globalStyle.fontFamily)
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
                    setField('fontSize', globalStyle.fontSize)
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
                value={override.fontSize ?? globalStyle.fontSize}
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
                    setField('highlightColor', globalStyle.highlightColor)
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
                  color={override.highlightColor ?? globalStyle.highlightColor}
                  onChange={(c) => setField('highlightColor', c)}
                />
                <div className="speaker-section__hex-row">
                  <span className="speaker-section__hex-prefix">#</span>
                  <HexColorInput
                    className="speaker-section__hex-input"
                    color={override.highlightColor ?? globalStyle.highlightColor}
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
                    setField('baseColor', globalStyle.baseColor)
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
                  color={override.baseColor ?? globalStyle.baseColor}
                  onChange={(c) => setField('baseColor', c)}
                />
                <div className="speaker-section__hex-row">
                  <span className="speaker-section__hex-prefix">#</span>
                  <HexColorInput
                    className="speaker-section__hex-input"
                    color={override.baseColor ?? globalStyle.baseColor}
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
                    setField('strokeWidth', globalStyle.strokeWidth)
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
                value={override.strokeWidth ?? globalStyle.strokeWidth}
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
                      setField('strokeColor', globalStyle.strokeColor)
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
                    color={override.strokeColor ?? globalStyle.strokeColor}
                    onChange={(c) => setField('strokeColor', c)}
                  />
                  <div className="speaker-section__hex-row">
                    <span className="speaker-section__hex-prefix">#</span>
                    <HexColorInput
                      className="speaker-section__hex-input"
                      color={override.strokeColor ?? globalStyle.strokeColor}
                      onChange={(c) => setField('strokeColor', c)}
                      prefixed={false}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Letter spacing override */}
          <div className="speaker-section__control-row">
            <label className="speaker-section__toggle-label">
              <input
                type="checkbox"
                checked={hasOverride('letterSpacing')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setField('letterSpacing', globalStyle.letterSpacing ?? 0)
                  } else {
                    toggleField('letterSpacing', false)
                  }
                }}
              />
              Override letter spacing
              {hasOverride('letterSpacing') && (
                <span className="speaker-section__value">{override.letterSpacing}px</span>
              )}
            </label>
            {hasOverride('letterSpacing') && (
              <input
                type="range"
                className="speaker-section__slider"
                min={-5}
                max={20}
                step={0.5}
                value={override.letterSpacing ?? (globalStyle.letterSpacing ?? 0)}
                onChange={(e) => setField('letterSpacing', Number(e.target.value))}
              />
            )}
          </div>

          {/* Word spacing override */}
          <div className="speaker-section__control-row">
            <label className="speaker-section__toggle-label">
              <input
                type="checkbox"
                checked={hasOverride('wordSpacing')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setField('wordSpacing', globalStyle.wordSpacing ?? 0)
                  } else {
                    toggleField('wordSpacing', false)
                  }
                }}
              />
              Override word spacing
              {hasOverride('wordSpacing') && (
                <span className="speaker-section__value">{override.wordSpacing}px</span>
              )}
            </label>
            {hasOverride('wordSpacing') && (
              <input
                type="range"
                className="speaker-section__slider"
                min={-5}
                max={30}
                step={1}
                value={override.wordSpacing ?? (globalStyle.wordSpacing ?? 0)}
                onChange={(e) => setField('wordSpacing', Number(e.target.value))}
              />
            )}
          </div>

          {/* Vertical position override */}
          <div className="speaker-section__control-row">
            <label className="speaker-section__toggle-label">
              <input
                type="checkbox"
                checked={hasOverride('verticalPosition')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setField('verticalPosition', globalStyle.verticalPosition)
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
                value={override.verticalPosition ?? globalStyle.verticalPosition}
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
