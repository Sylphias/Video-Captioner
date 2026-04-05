import { useState } from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import { FONT_NAMES, getFontFamily } from '@eigen/remotion-composition'
import type { SpeakerStyleOverride } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import './SpeakerStylePanel.css'

const SPEAKER_COLORS = [
  '#4A90D9',
  '#E67E22',
  '#27AE60',
  '#9B59B6',
  '#E74C3C',
  '#1ABC9C',
  '#F39C12',
  '#95A5A6',
]

function getSpeakerColor(speakerId: string): string {
  const idx = parseInt(speakerId.replace('SPEAKER_', ''), 10) % 8
  return SPEAKER_COLORS[isNaN(idx) ? 0 : idx]
}

type StyleField = keyof SpeakerStyleOverride

interface SpeakerSectionProps {
  speakerId: string
  displayName: string
  override: SpeakerStyleOverride
  onSet: (override: SpeakerStyleOverride) => void
  onClear: () => void
  defaultOpen?: boolean
}

function SpeakerSection({ speakerId, displayName, override, onSet, onClear, defaultOpen = false }: SpeakerSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const color = getSpeakerColor(speakerId)

  const setField = (field: StyleField, value: string | number) => {
    onSet({ [field]: value } as SpeakerStyleOverride)
  }

  const toggleField = (field: StyleField, checked: boolean) => {
    if (!checked) {
      // Remove this field: clear entire override, then re-set remaining fields
      const next = { ...override }
      delete next[field]
      onClear()
      if (Object.keys(next).length > 0) {
        onSet(next)
      }
    }
  }

  const hasOverride = (field: StyleField) => field in override

  return (
    <div className="speaker-section">
      <button
        className="speaker-section__header"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span
          className="speaker-section__dot"
          style={{ background: color }}
        />
        <span className="speaker-section__name">{displayName}</span>
        <span className="speaker-section__chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="speaker-section__body">
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

          {/* Stroke color override — only if strokeWidth override > 0 */}
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

          {/* Letter spacing override */}
          <div className="speaker-section__control-row">
            <label className="speaker-section__toggle-label">
              <input
                type="checkbox"
                checked={hasOverride('letterSpacing')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setField('letterSpacing', 0)
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
                value={override.letterSpacing ?? 0}
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
                    setField('wordSpacing', 0)
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
                value={override.wordSpacing ?? 0}
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
            onClick={onClear}
            type="button"
          >
            Clear all overrides
          </button>
        </div>
      )}
    </div>
  )
}

interface SpeakerStylePanelProps {
  singleSpeakerId?: string
}

export function SpeakerStylePanel({ singleSpeakerId }: SpeakerStylePanelProps = {}) {
  const speakerNames = useSubtitleStore((s) => s.speakerNames)
  const speakerStyles = useSubtitleStore((s) => s.speakerStyles)
  const setSpeakerStyle = useSubtitleStore((s) => s.setSpeakerStyle)
  const clearSpeakerStyle = useSubtitleStore((s) => s.clearSpeakerStyle)

  // Single-speaker mode: render only that speaker's controls directly (no collapsible header)
  if (singleSpeakerId) {
    const displayName = speakerNames[singleSpeakerId] ?? singleSpeakerId
    const override = speakerStyles[singleSpeakerId] ?? {}
    return (
      <div className="speaker-style-panel">
        <SpeakerSection
          key={singleSpeakerId}
          speakerId={singleSpeakerId}
          displayName={displayName}
          override={override}
          onSet={(o) => setSpeakerStyle(singleSpeakerId, o)}
          onClear={() => clearSpeakerStyle(singleSpeakerId)}
          defaultOpen
        />
      </div>
    )
  }

  const speakerIds = Object.keys(speakerNames)

  if (speakerIds.length === 0) {
    return (
      <div className="speaker-style-panel speaker-style-panel--empty">
        <p className="speaker-style-panel__empty-msg">
          Run speaker detection to enable per-speaker styles
        </p>
      </div>
    )
  }

  return (
    <div className="speaker-style-panel">
      <p className="speaker-style-panel__heading">Per-speaker overrides</p>
      {speakerIds.map((speakerId) => (
        <SpeakerSection
          key={speakerId}
          speakerId={speakerId}
          displayName={speakerNames[speakerId] ?? speakerId}
          override={speakerStyles[speakerId] ?? {}}
          onSet={(override) => setSpeakerStyle(speakerId, override)}
          onClear={() => clearSpeakerStyle(speakerId)}
        />
      ))}
    </div>
  )
}
