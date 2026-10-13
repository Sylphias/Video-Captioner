import { useState, useEffect } from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import { FONT_WEIGHT_OPTIONS } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import { FontPicker, ScrubInput } from './StyleControls.tsx'
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
  // Use individual selectors to minimize re-renders
  const fontFamily = useSubtitleStore((s) => s.style.fontFamily)
  const fontWeight = useSubtitleStore((s) => s.style.fontWeight)
  const fontSize = useSubtitleStore((s) => s.style.fontSize)
  const highlightColor = useSubtitleStore((s) => s.style.highlightColor)
  const baseColor = useSubtitleStore((s) => s.style.baseColor)
  const strokeWidth = useSubtitleStore((s) => s.style.strokeWidth)
  const strokeColor = useSubtitleStore((s) => s.style.strokeColor)
  const shadowColor = useSubtitleStore((s) => s.style.shadowColor)
  const shadowOffsetX = useSubtitleStore((s) => s.style.shadowOffsetX)
  const shadowOffsetY = useSubtitleStore((s) => s.style.shadowOffsetY)
  const shadowBlur = useSubtitleStore((s) => s.style.shadowBlur)
  const shadowType = useSubtitleStore((s) => s.style.shadowType ?? 'drop')
  const letterSpacing = useSubtitleStore((s) => s.style.letterSpacing)
  const wordSpacing = useSubtitleStore((s) => s.style.wordSpacing)
  const verticalPosition = useSubtitleStore((s) => s.style.verticalPosition)
  const laneGap = useSubtitleStore((s) => s.style.laneGap)
  const lingerDuration = useSubtitleStore((s) => s.style.lingerDuration)
  const maxWordsPerPhrase = useSubtitleStore((s) => s.maxWordsPerPhrase)
  const setStyle = useSubtitleStore((s) => s.setStyle)
  const setMaxWordsPerPhrase = useSubtitleStore((s) => s.setMaxWordsPerPhrase)

  return (
    <div className="style-panel">
      {/* Font selector */}
      <div className="style-panel__section">
        <label className="style-panel__label">Font</label>
        <FontPicker value={fontFamily} onChange={(family) => setStyle({ fontFamily: family })} />
      </div>

      {/* Font weight selector */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Weight <span className="style-panel__value">{FONT_WEIGHT_OPTIONS.find((w) => w.value === fontWeight)?.label ?? fontWeight}</span>
        </label>
        <div className="style-panel__weight-options">
          {FONT_WEIGHT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`style-panel__weight-btn${value === fontWeight ? ' style-panel__weight-btn--active' : ''}`}
              style={{ fontFamily, fontWeight: value }}
              onClick={() => setStyle({ fontWeight: value })}
              title={label}
            >
              Aa
            </button>
          ))}
        </div>
      </div>

      {/* Font size number input */}
      <div className="style-panel__section">
        <label className="style-panel__label">Font size</label>
        <div className="style-panel__inline-row">
          <ScrubInput
            value={fontSize}
            min={16}
            max={200}
            step={2}
            onChange={(v) => setStyle({ fontSize: v })}
          />
          <span className="style-panel__unit">px</span>
        </div>
      </div>

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

      {/* Highlight color */}
      <div className="style-panel__section">
        <label className="style-panel__label">Highlight color (active word)</label>
        <div className="style-panel__color-control">
          <HexColorPicker
            color={highlightColor}
            onChange={(color) => setStyle({ highlightColor: color })}
          />
          <div className="style-panel__hex-row">
            <span className="style-panel__hex-prefix">#</span>
            <HexColorInput
              className="style-panel__hex-input"
              color={highlightColor}
              onChange={(color) => setStyle({ highlightColor: color })}
              prefixed={false}
            />
          </div>
        </div>
      </div>

      {/* Base color */}
      <div className="style-panel__section">
        <label className="style-panel__label">Base color (inactive words)</label>
        <div className="style-panel__color-control">
          <HexColorPicker
            color={baseColor}
            onChange={(color) => setStyle({ baseColor: color })}
          />
          <div className="style-panel__hex-row">
            <span className="style-panel__hex-prefix">#</span>
            <HexColorInput
              className="style-panel__hex-input"
              color={baseColor}
              onChange={(color) => setStyle({ baseColor: color })}
              prefixed={false}
            />
          </div>
        </div>
      </div>

      {/* Stroke width */}
      <div className="style-panel__section">
        <label className="style-panel__label">Stroke width</label>
        <div className="style-panel__inline-row">
          <ScrubInput
            value={strokeWidth}
            min={0}
            max={30}
            step={0.5}
            onChange={(v) => setStyle({ strokeWidth: v })}
          />
          <span className="style-panel__unit">px</span>
        </div>
      </div>

      {/* Stroke color — only shown when strokeWidth > 0 */}
      {strokeWidth > 0 && (
        <div className="style-panel__section">
          <label className="style-panel__label">Stroke color</label>
          <div className="style-panel__color-control">
            <HexColorPicker
              color={strokeColor}
              onChange={(color) => setStyle({ strokeColor: color })}
            />
            <div className="style-panel__hex-row">
              <span className="style-panel__hex-prefix">#</span>
              <HexColorInput
                className="style-panel__hex-input"
                color={strokeColor}
                onChange={(color) => setStyle({ strokeColor: color })}
                prefixed={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Text shadow */}
      <div className="style-panel__section">
        <label className="style-panel__label">Shadow</label>
        <div className="style-panel__weight-options">
          <button
            type="button"
            className={`style-panel__weight-btn${shadowType === 'drop' ? ' style-panel__weight-btn--active' : ''}`}
            aria-pressed={shadowType === 'drop'}
            onClick={() => setStyle({ shadowType: 'drop' })}
          >
            Drop
          </button>
          <button
            type="button"
            className={`style-panel__weight-btn${shadowType === 'extrude' ? ' style-panel__weight-btn--active' : ''}`}
            aria-pressed={shadowType === 'extrude'}
            onClick={() => setStyle({ shadowType: 'extrude' })}
          >
            Extrude
          </button>
        </div>
        <div className="style-panel__inline-row">
          <label className="style-panel__mini-label">X</label>
          <ScrubInput
            value={shadowOffsetX}
            min={-20}
            max={20}
            step={1}
            onChange={(v) => setStyle({ shadowOffsetX: v })}
          />
          <label className="style-panel__mini-label">Y</label>
          <ScrubInput
            value={shadowOffsetY}
            min={-20}
            max={20}
            step={1}
            onChange={(v) => setStyle({ shadowOffsetY: v })}
          />
          <label className="style-panel__mini-label">Blur</label>
          <ScrubInput
            value={shadowBlur}
            min={0}
            max={30}
            step={1}
            onChange={(v) => setStyle({ shadowBlur: v })}
          />
        </div>
      </div>

      {/* Shadow color */}
      <div className="style-panel__section">
        <label className="style-panel__label">Shadow color</label>
        <div className="style-panel__color-control">
          <HexColorPicker
            color={shadowColor}
            onChange={(color) => setStyle({ shadowColor: color })}
          />
          <div className="style-panel__hex-row">
            <span className="style-panel__hex-prefix">#</span>
            <HexColorInput
              className="style-panel__hex-input"
              color={shadowColor}
              onChange={(color) => setStyle({ shadowColor: color })}
              prefixed={false}
            />
          </div>
        </div>
      </div>

      {/* Letter spacing (kerning) */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Letter spacing <span className="style-panel__value">{letterSpacing}px</span>
        </label>
        <input
          type="range"
          className="style-panel__slider"
          min={-5}
          max={20}
          step={0.5}
          value={letterSpacing}
          onChange={(e) => setStyle({ letterSpacing: Number(e.target.value) })}
        />
      </div>

      {/* Word spacing */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Word spacing <span className="style-panel__value">{wordSpacing}px</span>
        </label>
        <input
          type="range"
          className="style-panel__slider"
          min={-5}
          max={30}
          step={1}
          value={wordSpacing}
          onChange={(e) => setStyle({ wordSpacing: Number(e.target.value) })}
        />
      </div>

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
