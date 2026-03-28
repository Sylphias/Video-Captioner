import { useState, useRef, useEffect, useCallback } from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import { FONT_NAMES, getFontFamily, FONT_WEIGHT_OPTIONS } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import './StylePanel.css'

/**
 * Load a custom Google Font at runtime via the Google Fonts CSS API.
 * Returns the font family string on success, or null on failure.
 */
function loadCustomGoogleFont(fontName: string): Promise<string | null> {
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

/** Custom font picker that renders each option in its own font face. */
function FontPicker({ value, onChange }: { value: string; onChange: (family: string) => void }) {
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
          {!showCustomInput ? (
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
          )}
        </div>
      )}
    </div>
  )
}

// ── Scrub Input: number input with drag-to-adjust ───────────────────────────

interface ScrubInputProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

function ScrubInput({ value, min, max, step, onChange }: ScrubInputProps) {
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
