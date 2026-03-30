import type {
  AnimationPhaseConfig,
  ActivePhaseConfig,
  EnterExitType,
  ActiveType,
  EasingType,
  AnimationScope,
  HighlightKeyframeConfig,
  KeyframeTrack,
} from '@eigen/shared-types'
import './PhasePanel.css'

type Phase = 'enter' | 'active' | 'exit'

type ExitConfig = AnimationPhaseConfig & { mirrorEnter: boolean }

interface PhasePanelProps {
  phase: Phase
  config: AnimationPhaseConfig | ActivePhaseConfig | ExitConfig
  scope: AnimationScope
  onConfigChange: (config: AnimationPhaseConfig | ActivePhaseConfig | ExitConfig) => void
  onScopeChange: (scope: AnimationScope) => void
}

const ENTER_EXIT_TYPES: EnterExitType[] = [
  'none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right',
  'pop', 'bounce', 'fly-in', 'shrink', 'typewriter', 'letter-by-letter',
  'word-cascade', 'blur-reveal',
]

const ACTIVE_TYPES: ActiveType[] = ['none', 'jiggle', 'wave', 'pulse', 'bounce']

const EASING_TYPES: EasingType[] = [
  'linear', 'ease-in', 'ease-out', 'ease-in-out',
  'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic',
  'bounce', 'elastic', 'back', 'spring',
]

function formatLabel(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Slider control component
interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  disabled?: boolean
  onChange: (v: number) => void
  format?: (v: number) => string
}

function SliderControl({ label, value, min, max, step, disabled, onChange, format }: SliderProps) {
  const display = format ? format(value) : String(value)
  return (
    <div className={['phase-panel__control', disabled ? 'phase-panel__control--disabled' : ''].join(' ').trim()}>
      <div className="phase-panel__control-header">
        <label className="phase-panel__label">{label}</label>
        <span className="phase-panel__value">{display}</span>
      </div>
      <input
        className="phase-panel__slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

// Select control component
interface SelectProps {
  label: string
  value: string
  options: string[]
  disabled?: boolean
  onChange: (v: string) => void
}

function SelectControl({ label, value, options, disabled, onChange }: SelectProps) {
  return (
    <div className={['phase-panel__control', disabled ? 'phase-panel__control--disabled' : ''].join(' ').trim()}>
      <label className="phase-panel__label">{label}</label>
      <select
        className="phase-panel__select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{formatLabel(opt)}</option>
        ))}
      </select>
    </div>
  )
}

// Enter / Exit phase panel
interface EnterExitPanelProps {
  config: AnimationPhaseConfig
  disabled?: boolean
  onChange: (config: AnimationPhaseConfig) => void
}

function EnterExitPanel({ config, disabled, onChange }: EnterExitPanelProps) {
  const hasSlideOffset = ['slide-up', 'slide-down', 'slide-left', 'slide-right', 'fly-in'].includes(config.type)
  const hasStagger = config.type === 'word-cascade'

  return (
    <>
      <SelectControl
        label="Animation Type"
        value={config.type}
        options={ENTER_EXIT_TYPES}
        disabled={disabled}
        onChange={(v) => onChange({ ...config, type: v as EnterExitType })}
      />
      <SliderControl
        label="Duration"
        value={config.durationSec}
        min={0.05}
        max={2.0}
        step={0.05}
        disabled={disabled}
        onChange={(v) => onChange({ ...config, durationSec: v })}
        format={(v) => v.toFixed(2) + 's'}
      />
      <SelectControl
        label="Easing"
        value={config.easing}
        options={EASING_TYPES}
        disabled={disabled}
        onChange={(v) => onChange({ ...config, easing: v as EasingType })}
      />
      {hasSlideOffset && (
        <SliderControl
          label="Slide Offset"
          value={config.params.slideOffsetFraction ?? 0.2}
          min={0.05}
          max={0.5}
          step={0.05}
          disabled={disabled}
          onChange={(v) =>
            onChange({ ...config, params: { ...config.params, slideOffsetFraction: v } })
          }
          format={(v) => Math.round(v * 100) + '%'}
        />
      )}
      {hasStagger && (
        <SliderControl
          label="Stagger Frames"
          value={config.params.staggerFrames ?? 2}
          min={1}
          max={10}
          step={1}
          disabled={disabled}
          onChange={(v) =>
            onChange({ ...config, params: { ...config.params, staggerFrames: v } })
          }
          format={(v) => v + 'f'}
        />
      )}
    </>
  )
}

export function PhasePanel({ phase, config, scope, onConfigChange, onScopeChange }: PhasePanelProps) {
  const phaseLabels: Record<Phase, string> = {
    enter: 'Enter Animation',
    active: 'Hold Animation',
    exit: 'Exit Animation',
  }

  return (
    <div className="phase-panel">
      <h3 className="phase-panel__heading">{phaseLabels[phase]}</h3>

      {phase === 'enter' && (
        <>
          {/* Scope selector — only shown in enter phase */}
          <div className="phase-panel__control">
            <label className="phase-panel__label">Animation Scope</label>
            <div className="phase-panel__radio-group">
              <label className="phase-panel__radio-label">
                <input
                  type="radio"
                  name="scope"
                  value="phrase"
                  checked={scope === 'phrase'}
                  onChange={() => onScopeChange('phrase')}
                />
                Phrase
              </label>
              <label className="phase-panel__radio-label">
                <input
                  type="radio"
                  name="scope"
                  value="word"
                  checked={scope === 'word'}
                  onChange={() => onScopeChange('word')}
                />
                Word
              </label>
            </div>
          </div>

          <EnterExitPanel
            config={config as AnimationPhaseConfig}
            onChange={(c) => onConfigChange(c)}
          />
        </>
      )}

      {phase === 'active' && (() => {
        const ac = config as ActivePhaseConfig
        return (
          <>
            <SelectControl
              label="Animation Type"
              value={ac.type}
              options={ACTIVE_TYPES}
              onChange={(v) => onConfigChange({ ...ac, type: v as ActiveType })}
            />
            <SliderControl
              label="Cycle Duration"
              value={ac.cycleDurationSec}
              min={0.2}
              max={3.0}
              step={0.1}
              onChange={(v) => onConfigChange({ ...ac, cycleDurationSec: v })}
              format={(v) => v.toFixed(1) + 's'}
            />
            <SliderControl
              label="Intensity"
              value={ac.intensity}
              min={0.0}
              max={1.0}
              step={0.1}
              onChange={(v) => onConfigChange({ ...ac, intensity: v })}
              format={(v) => Math.round(v * 100) + '%'}
            />
          </>
        )
      })()}

      {phase === 'exit' && (() => {
        const ec = config as ExitConfig
        const disabled = ec.mirrorEnter

        return (
          <>
            <div className="phase-panel__control">
              <label className="phase-panel__checkbox-label">
                <input
                  type="checkbox"
                  checked={ec.mirrorEnter}
                  onChange={(e) => onConfigChange({ ...ec, mirrorEnter: e.target.checked })}
                />
                Mirror enter animation
              </label>
            </div>

            <EnterExitPanel
              config={ec}
              disabled={disabled}
              onChange={(c) => onConfigChange({ ...c, mirrorEnter: ec.mirrorEnter })}
            />
          </>
        )
      })()}
    </div>
  )
}

// ─── Highlight presets (quick selection for common karaoke word effects) ──────

type HighlightType = 'none' | 'scale' | 'pop' | 'lift' | 'bounce'

const HIGHLIGHT_PRESETS: Record<HighlightType, HighlightKeyframeConfig | undefined> = {
  none: undefined,
  scale: {
    enterPct: 30,
    enterTracks: [
      { property: 'scale', keyframes: [{ time: 0, value: 1 }, { time: 100, value: 1.15 }], easings: [{ type: 'ease-out' }] },
    ],
  },
  pop: {
    enterPct: 25,
    enterTracks: [
      { property: 'scale', keyframes: [{ time: 0, value: 1 }, { time: 60, value: 1.25 }, { time: 100, value: 1.12 }], easings: [{ type: 'ease-out' }, { type: 'ease-in-out' }] },
    ],
  },
  lift: {
    enterPct: 30,
    enterTracks: [
      { property: 'y', keyframes: [{ time: 0, value: 0 }, { time: 100, value: -3 }], easings: [{ type: 'ease-out' }] },
    ],
  },
  bounce: {
    enterPct: 35,
    enterTracks: [
      { property: 'y', keyframes: [{ time: 0, value: 0 }, { time: 40, value: -5 }, { time: 70, value: -2 }, { time: 100, value: -3 }], easings: [{ type: 'ease-out' }, { type: 'ease-in' }, { type: 'ease-out' }] },
    ],
  },
}

function detectHighlightType(hl?: HighlightKeyframeConfig): HighlightType {
  if (!hl || hl.enterTracks.length === 0) return 'none'
  const track = hl.enterTracks[0]
  if (track.property === 'scale' && track.keyframes.length === 2) return 'scale'
  if (track.property === 'scale' && track.keyframes.length === 3) return 'pop'
  if (track.property === 'y' && track.keyframes.length === 2) return 'lift'
  if (track.property === 'y' && track.keyframes.length >= 4) return 'bounce'
  return 'none' // custom keyframes — show as none for now
}

interface HighlightPanelProps {
  highlight?: HighlightKeyframeConfig
  onChange: (hl: HighlightKeyframeConfig | undefined) => void
}

export function HighlightPanel({ highlight, onChange }: HighlightPanelProps) {
  const currentType = detectHighlightType(highlight)
  const enterPct = highlight?.enterPct ?? 30

  return (
    <div className="phase-panel">
      <h3 className="phase-panel__heading">Highlight Animation</h3>
      <SelectControl
        label="Highlight Type"
        value={currentType}
        options={['none', 'scale', 'pop', 'lift', 'bounce']}
        onChange={(v) => {
          const preset = HIGHLIGHT_PRESETS[v as HighlightType]
          onChange(preset ? { ...preset } : undefined)
        }}
      />
      {currentType !== 'none' && (
        <SliderControl
          label="Enter %"
          value={enterPct}
          min={5}
          max={80}
          step={5}
          onChange={(v) => {
            if (highlight) onChange({ ...highlight, enterPct: v })
          }}
          format={(v) => v + '%'}
        />
      )}
    </div>
  )
}
