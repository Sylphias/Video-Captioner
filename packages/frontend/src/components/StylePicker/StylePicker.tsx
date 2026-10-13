import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { buildTextShadow, scaleLookStyle } from '@eigen/remotion-composition'
import type { LookStyleProps } from '@eigen/remotion-composition'
import { useTextStyles } from '../../hooks/useTextStyles.ts'
import './StylePicker.css'

/** Font size (px) every picker entry is drawn at. */
export const PICKER_FONT_PX = 22

/**
 * Inline style that draws a style's name in that style (D-12). Uses the same
 * buildTextShadow as SubtitleOverlay so outline, drop and extrude match the render.
 */
export function stylePickerEntryStyle(props: LookStyleProps): CSSProperties {
  const t = scaleLookStyle(props, PICKER_FONT_PX)
  return {
    fontFamily: t.fontFamily,
    fontWeight: t.fontWeight,
    fontSize: t.fontSize,
    color: t.baseColor,
    letterSpacing: t.letterSpacing || undefined,
    textShadow: buildTextShadow(t),
  }
}

export interface StylePickerProps {
  onApply: (props: LookStyleProps) => void
  label?: string
}

/**
 * Stateless "Apply style" action menu. It has no selected value because styles are
 * copied into the project, not linked (D-10).
 */
export function StylePicker({ onApply, label = 'Apply style…' }: StylePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { styles, loading, error } = useTextStyles()

  // Close on outside mousedown and on Escape
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const builtin = styles.filter((s) => s.isBuiltin)
  const user = styles.filter((s) => !s.isBuiltin)

  const renderItem = (s: (typeof styles)[number]) => (
    <button
      key={s.id}
      type="button"
      className="style-picker__item"
      onClick={() => {
        onApply(s.props)
        setOpen(false)
      }}
    >
      <span className="style-picker__item-name" style={stylePickerEntryStyle(s.props)}>
        {s.name}
      </span>
      <span
        className="style-picker__swatch"
        style={{ background: s.props.highlightColor }}
        aria-hidden="true"
      />
    </button>
  )

  return (
    <div className="style-picker" ref={containerRef}>
      <button
        type="button"
        className="style-picker__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <span className="style-picker__arrow" />
      </button>
      {open && (
        <div className="style-picker__menu" role="menu">
          {loading && styles.length === 0 && <p className="style-picker__status">Loading styles…</p>}
          {error && styles.length === 0 && <p className="style-picker__status">Couldn't load styles</p>}
          {builtin.length > 0 && (
            <>
              <p className="style-picker__heading">Built-in</p>
              {builtin.map(renderItem)}
            </>
          )}
          {user.length > 0 && (
            <>
              <p className="style-picker__heading">My styles</p>
              {user.map(renderItem)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
