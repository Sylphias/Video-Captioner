import { useState, useRef, useEffect, useCallback } from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import {
  FONT_NAMES,
  getFontFamily,
  FONT_WEIGHT_OPTIONS,
  shadowTypePatch,
} from '@eigen/remotion-composition'
import type { LookStyleProps, ShadowType } from '@eigen/remotion-composition'
import './StylePanel.css'

/**
 * Load a custom Google Font at runtime via the Google Fonts CSS API.
 * Returns the font family string on success, or null on failure.
 */
export function loadCustomGoogleFont(fontName: string): Promise<string | null> {
  const family = fontName.trim()
  if (!family) return Promise.resolve(null)
  const id = `custom-google-font-${family.replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return Promise.resolve(family) // already loaded
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`
    link.onload = () => resolve(family)
    link.onerror = () => resolve(null)
    document.head.appendChild(link)
  })
}

interface FontPickerProps {
  value: string
  onChange: (family: string) => void
  /** Offer the "Other Google Font..." entry (runtime <link> injection). Default true. */
  allowCustomFont?: boolean
}

/** Custom font picker that renders each option in its own font face. */
export function FontPicker({ value, onChange, allowCustomFont = true }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customDraft, setCustomDraft] = useState('')
  const [customError, setCustomError] = useState('')
  const [loadingCustom, setLoadingCustom] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCustomInput(false)
        setCustomError('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus input when custom mode opens
  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus()
    }
  }, [showCustomInput])

  // Check if current value is a known font or a custom one
  const selectedName = FONT_NAMES.find((n) => getFontFamily(n) === value)
  const displayLabel = selectedName ?? value

  const handleSelect = useCallback((family: string) => {
    onChange(family)
    setOpen(false)
    setShowCustomInput(false)
    setCustomError('')
  }, [onChange])

  const handleCustomSubmit = useCallback(async () => {
    const name = customDraft.trim()
    if (!name) return
    setLoadingCustom(true)
    setCustomError('')
    const family = await loadCustomGoogleFont(name)
    setLoadingCustom(false)
    if (family) {
      onChange(family)
      setOpen(false)
      setShowCustomInput(false)
      setCustomDraft('')
    } else {
      setCustomError(`Could not load "${name}"`)
    }
  }, [customDraft, onChange])

  return (
    <div className="font-picker" ref={containerRef}>
      <button
        type="button"
        className="font-picker__trigger"
        style={{ fontFamily: value }}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{displayLabel}</span>
        <span className="font-picker__arrow" />
      </button>
      {open && (
        <div className="font-picker__dropdown">
          {FONT_NAMES.map((name) => {
            const family = getFontFamily(name)
            const isSelected = family === value
            return (
              <button
                key={name}
                type="button"
                className={`font-picker__option${isSelected ? ' font-picker__option--selected' : ''}`}
                style={{ fontFamily: family }}
                onClick={() => handleSelect(family)}
              >
                {name}
              </button>
            )
          })}

          {/* Custom Google Font input */}
          {allowCustomFont && (!showCustomInput ? (
            <button
              type="button"
              className="font-picker__option font-picker__option--custom-trigger"
              onClick={() => setShowCustomInput(true)}
            >
              Other Google Font...
            </button>
          ) : (
            <div className="font-picker__custom-row">
              <input
                ref={customInputRef}
                className="font-picker__custom-input"
                type="text"
                placeholder="e.g. Archivo Narrow"
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit() }}
                disabled={loadingCustom}
              />
              <button
                type="button"
                className="font-picker__custom-btn"
                onClick={handleCustomSubmit}
                disabled={loadingCustom || !customDraft.trim()}
              >
                {loadingCustom ? '...' : 'Load'}
              </button>
              {customError && <span className="font-picker__custom-error">{customError}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Scrub Input: number input with drag-to-adjust ───────────────────────────

export interface ScrubInputProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

export function ScrubInput({ value, min, max, step, onChange }: ScrubInputProps) {
  const dragRef = useRef(false)
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = useCallback(() => {
    const v = Number(draft)
    if (!isNaN(v)) {
      onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)))
    } else {
      setDraft(String(value))
    }
  }, [draft, value, min, max, step, onChange])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    if (document.activeElement === e.currentTarget) return
    const startX = e.clientX
    const startVal = value
    dragRef.current = false
    const input = e.currentTarget

    const onMove = (moveE: MouseEvent) => {
      const dx = moveE.clientX - startX
      if (!dragRef.current && Math.abs(dx) < 3) return
      dragRef.current = true
      document.body.style.cursor = 'ew-resize'
      const scale = moveE.shiftKey ? step * 0.2 : step
      const raw = startVal + dx * scale * 0.1
      const clamped = Math.min(max, Math.max(min, Math.round(raw / step) * step))
      onChange(clamped)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      if (dragRef.current) {
        input.blur()
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [value, min, max, step, onChange])

  return (
    <input
      type="number"
      className="style-panel__scrub-input"
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
      onMouseDown={handleMouseDown}
      title="Drag sideways to adjust, Shift+drag for fine control"
    />
  )
}

// ── StyleControls: presentational look-property editor ──────────────────────

export interface StyleControlsProps {
  value: LookStyleProps
  onChange: (patch: Partial<LookStyleProps>) => void
  /** Offer the "Other Google Font..." entry in the font picker. Default true. */
  allowCustomFont?: boolean
  /** Render every control non-interactive (read-only built-ins). */
  disabled?: boolean
}

/**
 * The D-05 look controls (font, colours, stroke, shadow, spacing) as a pure
 * value + onChange component. It never touches the project store, so the
 * Global Style panel (bound to the store) and the Style Studio (bound to a
 * draft) share one implementation (D-02). Layout controls are not part of it.
 */
export function StyleControls({
  value,
  onChange,
  allowCustomFont = true,
  disabled = false,
}: StyleControlsProps) {
  const isExtrude = value.shadowType === 'extrude'
  const offsetMin = isExtrude ? -100 : -20
  const offsetMax = isExtrude ? 100 : 20
  const setShadowType = (next: ShadowType) => onChange(shadowTypePatch(value, next))

  return (
    <fieldset
      className={`style-controls${disabled ? ' style-controls--disabled' : ''}`}
      disabled={disabled}
    >
      {/* Font selector */}
      <div className="style-panel__section">
        <label className="style-panel__label">Font</label>
        <FontPicker
          value={value.fontFamily}
          onChange={(family) => onChange({ fontFamily: family })}
          allowCustomFont={allowCustomFont}
        />
      </div>

      {/* Font weight selector */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Weight <span className="style-panel__value">{FONT_WEIGHT_OPTIONS.find((w) => w.value === value.fontWeight)?.label ?? value.fontWeight}</span>
        </label>
        <div className="style-panel__weight-options">
          {FONT_WEIGHT_OPTIONS.map(({ value: weight, label }) => (
            <button
              key={weight}
              type="button"
              className={`style-panel__weight-btn${weight === value.fontWeight ? ' style-panel__weight-btn--active' : ''}`}
              style={{ fontFamily: value.fontFamily, fontWeight: weight }}
              onClick={() => onChange({ fontWeight: weight })}
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
            value={value.fontSize}
            min={16}
            max={200}
            step={2}
            onChange={(v) => onChange({ fontSize: v })}
          />
          <span className="style-panel__unit">px</span>
        </div>
      </div>

      {/* Highlight color */}
      <div className="style-panel__section">
        <label className="style-panel__label">Highlight color (active word)</label>
        <div className="style-panel__color-control">
          <HexColorPicker
            color={value.highlightColor}
            onChange={(color) => onChange({ highlightColor: color })}
          />
          <div className="style-panel__hex-row">
            <span className="style-panel__hex-prefix">#</span>
            <HexColorInput
              className="style-panel__hex-input"
              color={value.highlightColor}
              onChange={(color) => onChange({ highlightColor: color })}
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
            color={value.baseColor}
            onChange={(color) => onChange({ baseColor: color })}
          />
          <div className="style-panel__hex-row">
            <span className="style-panel__hex-prefix">#</span>
            <HexColorInput
              className="style-panel__hex-input"
              color={value.baseColor}
              onChange={(color) => onChange({ baseColor: color })}
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
            value={value.strokeWidth}
            min={0}
            max={30}
            step={0.5}
            onChange={(v) => onChange({ strokeWidth: v })}
          />
          <span className="style-panel__unit">px</span>
        </div>
      </div>

      {/* Stroke color — only shown when strokeWidth > 0 */}
      {value.strokeWidth > 0 && (
        <div className="style-panel__section">
          <label className="style-panel__label">Stroke color</label>
          <div className="style-panel__color-control">
            <HexColorPicker
              color={value.strokeColor}
              onChange={(color) => onChange({ strokeColor: color })}
            />
            <div className="style-panel__hex-row">
              <span className="style-panel__hex-prefix">#</span>
              <HexColorInput
                className="style-panel__hex-input"
                color={value.strokeColor}
                onChange={(color) => onChange({ strokeColor: color })}
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
            className={`style-panel__weight-btn${!isExtrude ? ' style-panel__weight-btn--active' : ''}`}
            aria-pressed={!isExtrude}
            onClick={() => setShadowType('drop')}
          >
            Drop
          </button>
          <button
            type="button"
            className={`style-panel__weight-btn${isExtrude ? ' style-panel__weight-btn--active' : ''}`}
            aria-pressed={isExtrude}
            onClick={() => setShadowType('extrude')}
          >
            Extrude
          </button>
        </div>
        <div className="style-panel__inline-row style-panel__inline-row--wrap">
          <label className="style-panel__mini-label">{isExtrude ? 'Depth X' : 'X'}</label>
          <ScrubInput
            value={value.shadowOffsetX}
            min={offsetMin}
            max={offsetMax}
            step={1}
            onChange={(v) => onChange({ shadowOffsetX: v })}
          />
          <label className="style-panel__mini-label">{isExtrude ? 'Depth Y' : 'Y'}</label>
          <ScrubInput
            value={value.shadowOffsetY}
            min={offsetMin}
            max={offsetMax}
            step={1}
            onChange={(v) => onChange({ shadowOffsetY: v })}
          />
          {!isExtrude && (
            <>
              <label className="style-panel__mini-label">Blur</label>
              <ScrubInput
                value={value.shadowBlur}
                min={0}
                max={30}
                step={1}
                onChange={(v) => onChange({ shadowBlur: v })}
              />
            </>
          )}
        </div>
        {isExtrude && (
          <p className="style-panel__hint">Solid 3D block in the shadow colour. Blur is ignored.</p>
        )}
      </div>

      {/* Shadow color */}
      <div className="style-panel__section">
        <label className="style-panel__label">Shadow color</label>
        <div className="style-panel__color-control">
          <HexColorPicker
            color={value.shadowColor}
            onChange={(color) => onChange({ shadowColor: color })}
          />
          <div className="style-panel__hex-row">
            <span className="style-panel__hex-prefix">#</span>
            <HexColorInput
              className="style-panel__hex-input"
              color={value.shadowColor}
              onChange={(color) => onChange({ shadowColor: color })}
              prefixed={false}
            />
          </div>
        </div>
      </div>

      {/* Letter spacing (kerning) */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Letter spacing <span className="style-panel__value">{value.letterSpacing}px</span>
        </label>
        <input
          type="range"
          className="style-panel__slider"
          min={-5}
          max={20}
          step={0.5}
          value={value.letterSpacing}
          onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
        />
      </div>

      {/* Word spacing */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Word spacing <span className="style-panel__value">{value.wordSpacing}px</span>
        </label>
        <input
          type="range"
          className="style-panel__slider"
          min={-5}
          max={30}
          step={1}
          value={value.wordSpacing}
          onChange={(e) => onChange({ wordSpacing: Number(e.target.value) })}
        />
      </div>
    </fieldset>
  )
}
