import { useState, useEffect, useRef, useCallback } from 'react'
import type { KeyframeEasing, CubicBezierEasing } from '@eigen/shared-types'
import { BezierEditor } from './BezierEditor'
import './EasingPicker.css'

interface EasingPickerProps {
  value: KeyframeEasing
  onChange: (easing: KeyframeEasing) => void
  label?: string
}

// Preset easing options with inline SVG curve path thumbnails
// SVG viewBox "0 0 20 20": start=(0,20)=bezier(0,0), end=(20,0)=bezier(1,1)
interface PresetOption {
  easing: KeyframeEasing
  label: string
  path: string  // SVG path d attribute
}

const PRESET_EASINGS: PresetOption[] = [
  { easing: { type: 'linear' },         label: 'Linear',          path: 'M 0,20 L 20,0' },
  { easing: { type: 'ease-in' },        label: 'Ease In',         path: 'M 0,20 C 8,20 16,4 20,0' },
  { easing: { type: 'ease-out' },       label: 'Ease Out',        path: 'M 0,20 C 4,16 12,0 20,0' },
  { easing: { type: 'ease-in-out' },    label: 'Ease In-Out',     path: 'M 0,20 C 8,20 12,0 20,0' },
  { easing: { type: 'ease-in-cubic' },  label: 'Ease In Cubic',   path: 'M 0,20 C 12,20 18,6 20,0' },
  { easing: { type: 'ease-out-cubic' }, label: 'Ease Out Cubic',  path: 'M 0,20 C 2,14 8,0 20,0' },
  { easing: { type: 'ease-in-out-cubic' }, label: 'Ease In-Out Cubic', path: 'M 0,20 C 12,20 8,0 20,0' },
  { easing: { type: 'bounce' },         label: 'Bounce',          path: 'M 0,20 C 4,20 6,0 8,0 C 10,0 10,4 12,4 C 14,4 14,0 16,0 C 18,0 18,2 20,0' },
  { easing: { type: 'elastic' },        label: 'Elastic',         path: 'M 0,20 C 6,20 8,-4 12,0 C 14,2 16,0 20,0' },
]

// Custom/bezier placeholder path for the thumbnail
const CUSTOM_PATH = 'M 0,20 C 4,4 16,16 20,0'

// Default bezier values when switching to Custom
const DEFAULT_BEZIER: CubicBezierEasing = { type: 'bezier', p1x: 0.25, p1y: 0.1, p2x: 0.25, p2y: 1 }

function isCustomBezier(easing: KeyframeEasing): easing is CubicBezierEasing {
  return easing.type === 'bezier'
}

function getLabel(easing: KeyframeEasing): string {
  if (isCustomBezier(easing)) return 'Custom'
  const found = PRESET_EASINGS.find((p) => p.easing.type === easing.type)
  return found?.label ?? easing.type
}

function getPath(easing: KeyframeEasing): string {
  if (isCustomBezier(easing)) return CUSTOM_PATH
  const found = PRESET_EASINGS.find((p) => p.easing.type === easing.type)
  return found?.path ?? 'M 0,20 L 20,0'
}

function ThumbnailSvg({ path }: { path: string }) {
  return (
    <svg
      className="easing-picker__thumbnail"
      viewBox="0 0 20 20"
      width={20}
      height={20}
    >
      <path d={path} />
    </svg>
  )
}

export function EasingPicker({ value, onChange, label }: EasingPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isCustom = isCustomBezier(value)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return

    function handleDocumentClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [open])

  const handlePresetSelect = useCallback((easing: KeyframeEasing) => {
    onChange(easing)
    setOpen(false)
  }, [onChange])

  const handleCustomSelect = useCallback(() => {
    // If already bezier, keep current values; otherwise switch to default bezier
    if (!isCustomBezier(value)) {
      onChange(DEFAULT_BEZIER)
    }
    setOpen(false)
  }, [value, onChange])

  const handleBezierChange = useCallback((p1x: number, p1y: number, p2x: number, p2y: number) => {
    onChange({ type: 'bezier', p1x, p1y, p2x, p2y })
  }, [onChange])

  const currentPath = getPath(value)
  const currentLabel = getLabel(value)

  return (
    <div className="easing-picker" ref={containerRef}>
      {label && (
        <span className="easing-picker__label">{label}</span>
      )}

      {/* Trigger button */}
      <button
        type="button"
        className="easing-picker__button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <ThumbnailSvg path={currentPath} />
        <span className="easing-picker__button-label">{currentLabel}</span>
        <span className="easing-picker__chevron" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="easing-picker__dropdown" role="listbox">
          {/* Preset options */}
          {PRESET_EASINGS.map((option) => {
            const selected = !isCustom && value.type === option.easing.type
            return (
              <button
                key={option.easing.type}
                type="button"
                role="option"
                aria-selected={selected}
                className={[
                  'easing-picker__option',
                  selected ? 'easing-picker__option--selected' : '',
                ].join(' ').trim()}
                onClick={() => handlePresetSelect(option.easing)}
              >
                <ThumbnailSvg path={option.path} />
                <span>{option.label}</span>
              </button>
            )
          })}

          {/* Custom option */}
          <button
            type="button"
            role="option"
            aria-selected={isCustom}
            className={[
              'easing-picker__option',
              isCustom ? 'easing-picker__option--selected' : '',
            ].join(' ').trim()}
            onClick={handleCustomSelect}
          >
            <ThumbnailSvg path={CUSTOM_PATH} />
            <span>Custom</span>
          </button>
        </div>
      )}

      {/* Inline BezierEditor shown when custom bezier is active */}
      {isCustom && (
        <div className="easing-picker__bezier-container">
          <BezierEditor
            p1x={value.p1x}
            p1y={value.p1y}
            p2x={value.p2x}
            p2y={value.p2y}
            onChange={handleBezierChange}
          />
        </div>
      )}
    </div>
  )
}
