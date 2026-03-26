import React, { useEffect, useState, useCallback, useMemo } from 'react'
import type { AnimationPreset, KeyframePhases, KeyframeTrack, KeyframeEasing, KeyframeFps, AnimationPhaseConfig, ActivePhaseConfig } from '@eigen/shared-types'
import { isLegacyKeyframeTracks } from '@eigen/shared-types'
import { useAnimationPresets } from '../../hooks/useAnimationPresets'
import { useBuilderStore } from './useBuilderStore'
import { KeyframePreview } from './KeyframePreview'
import { KeyframeTimeline } from './KeyframeTimeline'
import './AnimationBuilderPage.css'

// ─── Synthesize keyframe tracks from built-in animation configs ──────────────

const DEFAULT_FPS = 30

type SimpleEasingType = Exclude<KeyframeEasing, { type: 'bezier' }>['type']

function mapEasing(easing: string): KeyframeEasing {
  const valid: SimpleEasingType[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic', 'bounce', 'elastic']
  const matched = valid.find((v) => v === easing)
  if (matched) return { type: matched }
  return { type: 'ease-out' }
}

function synthesizeEnterTracks(config: AnimationPhaseConfig, durationFrames: number): KeyframeTrack[] {
  const tracks: KeyframeTrack[] = []
  const last = durationFrames
  const easing = mapEasing(config.easing)
  const offset = (config.params.slideOffsetFraction ?? 0.15) * 100

  switch (config.type) {
    case 'none':
      break
    case 'fade':
      tracks.push({ property: 'opacity', keyframes: [{ time: 0, value: 0 }, { time: last, value: 1 }], easings: [easing] })
      break
    case 'slide-up':
      tracks.push({ property: 'y', keyframes: [{ time: 0, value: 50 + offset }, { time: last, value: 50 }], easings: [easing] })
      tracks.push({ property: 'opacity', keyframes: [{ time: 0, value: 0 }, { time: last, value: 1 }], easings: [easing] })
      break
    case 'slide-down':
      tracks.push({ property: 'y', keyframes: [{ time: 0, value: 50 - offset }, { time: last, value: 50 }], easings: [easing] })
      tracks.push({ property: 'opacity', keyframes: [{ time: 0, value: 0 }, { time: last, value: 1 }], easings: [easing] })
      break
    case 'slide-left':
      tracks.push({ property: 'x', keyframes: [{ time: 0, value: 50 + offset }, { time: last, value: 50 }], easings: [easing] })
      tracks.push({ property: 'opacity', keyframes: [{ time: 0, value: 0 }, { time: last, value: 1 }], easings: [easing] })
      break
    case 'slide-right':
      tracks.push({ property: 'x', keyframes: [{ time: 0, value: 50 - offset }, { time: last, value: 50 }], easings: [easing] })
      tracks.push({ property: 'opacity', keyframes: [{ time: 0, value: 0 }, { time: last, value: 1 }], easings: [easing] })
      break
    case 'fly-in': {
      const flyOffset = (config.params.slideOffsetFraction ?? 0.5) * 100
      tracks.push({ property: 'x', keyframes: [{ time: 0, value: 50 + flyOffset }, { time: last, value: 50 }], easings: [easing] })
      tracks.push({ property: 'opacity', keyframes: [{ time: 0, value: 0 }, { time: last, value: 1 }], easings: [easing] })
      break
    }
    case 'pop':
      tracks.push({ property: 'scale', keyframes: [{ time: 0, value: 0 }, { time: last, value: 1 }], easings: [{ type: 'elastic' }] })
      break
    case 'bounce':
      tracks.push({ property: 'scale', keyframes: [{ time: 0, value: 0 }, { time: last, value: 1 }], easings: [{ type: 'bounce' }] })
      break
    case 'shrink':
      tracks.push({ property: 'scale', keyframes: [{ time: 0, value: 1.5 }, { time: last, value: 1 }], easings: [easing] })
      tracks.push({ property: 'opacity', keyframes: [{ time: 0, value: 0 }, { time: last, value: 1 }], easings: [easing] })
      break
    case 'blur-reveal':
    case 'typewriter':
    case 'letter-by-letter':
    case 'word-cascade':
      tracks.push({ property: 'opacity', keyframes: [{ time: 0, value: 0 }, { time: last, value: 1 }], easings: [easing] })
      break
  }
  return tracks
}

function synthesizeExitTracks(config: AnimationPhaseConfig & { mirrorEnter: boolean }, enterConfig: AnimationPhaseConfig, durationFrames: number): KeyframeTrack[] {
  // Determine which config to base the exit on
  const baseConfig = config.mirrorEnter ? enterConfig : config
  const tracks = synthesizeEnterTracks(baseConfig, durationFrames)

  // Reverse: swap first and last keyframe values so it goes from neutral to exit state
  return tracks.map((track) => {
    if (track.keyframes.length !== 2) return track
    return {
      ...track,
      keyframes: [
        { time: 0, value: track.keyframes[1].value },
        { time: durationFrames, value: track.keyframes[0].value },
      ],
    }
  })
}

function synthesizeActiveTracks(config: ActivePhaseConfig, cycleDurationFrames: number): KeyframeTrack[] {
  const tracks: KeyframeTrack[] = []
  const c = cycleDurationFrames
  const intensity = config.intensity ?? 1
  const lin: KeyframeEasing = { type: 'ease-in-out' }

  switch (config.type) {
    case 'none':
      break
    case 'jiggle': {
      const amp = intensity * 3
      const q = Math.round(c / 4)
      tracks.push({
        property: 'rotation',
        keyframes: [
          { time: 0, value: 0 },
          { time: q, value: amp },
          { time: q * 2, value: 0 },
          { time: q * 3, value: -amp },
          { time: c, value: 0 },
        ],
        easings: [lin, lin, lin, lin],
      })
      break
    }
    case 'wave': {
      const dy = intensity * 2
      const q = Math.round(c / 4)
      tracks.push({
        property: 'y',
        keyframes: [
          { time: 0, value: 50 },
          { time: q, value: 50 - dy },
          { time: q * 2, value: 50 },
          { time: q * 3, value: 50 + dy },
          { time: c, value: 50 },
        ],
        easings: [lin, lin, lin, lin],
      })
      break
    }
    case 'pulse': {
      const ds = intensity * 0.05
      const q = Math.round(c / 4)
      tracks.push({
        property: 'scale',
        keyframes: [
          { time: 0, value: 1 },
          { time: q, value: 1 + ds },
          { time: q * 2, value: 1 },
          { time: q * 3, value: 1 - ds },
          { time: c, value: 1 },
        ],
        easings: [lin, lin, lin, lin],
      })
      break
    }
    case 'bounce': {
      const dy = intensity * 2
      const half = Math.round(c / 2)
      tracks.push({
        property: 'y',
        keyframes: [
          { time: 0, value: 50 },
          { time: half, value: 50 - dy },
          { time: c, value: 50 },
        ],
        easings: [{ type: 'ease-out' }, { type: 'ease-in' }],
      })
      break
    }
  }
  return tracks
}

/**
 * Convert a built-in animation preset's enter/active/exit configs
 * into editable keyframe tracks.
 */
function synthesizeTracksFromPreset(preset: AnimationPreset): KeyframePhases {
  const fps = DEFAULT_FPS
  const enterDur = Math.max(1, Math.round(preset.enter.durationSec * fps))
  const exitDur = Math.max(1, Math.round(preset.exit.durationSec * fps))
  const activeDur = Math.max(1, Math.round(preset.active.cycleDurationSec * fps))

  return {
    fps,
    enter: {
      durationFrames: enterDur,
      tracks: synthesizeEnterTracks(preset.enter, enterDur),
    },
    active: {
      durationFrames: activeDur,
      tracks: synthesizeActiveTracks(preset.active, activeDur),
      cycleDurationFrames: activeDur,
    },
    exit: {
      durationFrames: exitDur,
      tracks: synthesizeExitTracks(preset.exit, preset.enter, exitDur),
    },
  }
}

// ─── Preset classification ───────────────────────────────────────────────────

/** Does this preset have meaningful enter/exit animations? */
function isEnterExitPreset(preset: AnimationPreset): boolean {
  if (preset.enter.type !== 'none' || preset.exit.type !== 'none') return true
  // For user presets with keyframeTracks, check if enter/exit phases have tracks
  const kf = preset.keyframeTracks
  if (kf && !isLegacyKeyframeTracks(kf)) {
    if (kf.enter.tracks.length > 0 || kf.exit.tracks.length > 0) return true
  }
  return false
}

/** Does this preset have a meaningful hold (active cycle) animation? */
function isHoldPreset(preset: AnimationPreset): boolean {
  if (preset.active.type !== 'none') return true
  // For user presets with keyframeTracks, check if active phase has tracks
  const kf = preset.keyframeTracks
  if (kf && !isLegacyKeyframeTracks(kf)) {
    if (kf.active.tracks.length > 0) return true
  }
  return false
}

/** Does this preset have highlight animation keyframes? */
function isHighlightPreset(preset: AnimationPreset): boolean {
  const hl = preset.highlightAnimation
  return !!hl && hl.enterTracks.length > 0
}

// ─── Rescale phases to target FPS ────────────────────────────────────────────

/** Scale a KeyframePhases from its source fps to a target fps, preserving durations in seconds. */
function rescalePhases(phases: KeyframePhases, targetFps: number): KeyframePhases {
  if (phases.fps === targetFps) return phases
  const ratio = targetFps / phases.fps

  function rescaleTracks(tracks: KeyframeTrack[]): KeyframeTrack[] {
    return tracks.map((t) => ({
      ...t,
      keyframes: t.keyframes.map((kf) => ({ ...kf, time: Math.round(kf.time * ratio) })),
    }))
  }

  return {
    fps: targetFps as KeyframeFps,
    enter: {
      durationFrames: Math.round(phases.enter.durationFrames * ratio),
      tracks: rescaleTracks(phases.enter.tracks),
    },
    active: {
      durationFrames: Math.round(phases.active.durationFrames * ratio),
      tracks: rescaleTracks(phases.active.tracks),
      cycleDurationFrames: Math.round(phases.active.cycleDurationFrames * ratio),
    },
    exit: {
      durationFrames: Math.round(phases.exit.durationFrames * ratio),
      tracks: rescaleTracks(phases.exit.tracks),
    },
  }
}

// ─── Load preset into store ──────────────────────────────────────────────────

/** Load keyframe phases from a preset into the builder store. */
function loadPresetIntoStore(preset: AnimationPreset) {
  const store = useBuilderStore.getState()
  store.setPreset(preset)
  store.setScope(preset.scope)
  store.setStaggerFrames(Math.round((preset.enter.params.staggerFrames ?? 3) * (store.fps / DEFAULT_FPS)))
  // Load highlight keyframe data
  const hl = preset.highlightAnimation as any
  if (hl && hl.enterTracks?.length > 0) {
    if (hl.enterPct !== undefined) {
      // New percentage-based format
      useBuilderStore.setState({
        highlightEnterPct: hl.enterPct,
        highlightEnterTracks: hl.enterTracks,
      })
    } else if (hl.enterDurationFrames !== undefined && hl.fps) {
      // Legacy frame-based format — convert keyframe times to 0-100 percentage
      const maxTime = hl.enterDurationFrames
      const convertedTracks = hl.enterTracks.map((t: any) => ({
        ...t,
        keyframes: t.keyframes.map((kf: any) => ({
          ...kf,
          time: maxTime > 0 ? Math.round((kf.time / maxTime) * 100) : 0,
        })),
      }))
      useBuilderStore.setState({
        highlightEnterPct: 30,
        highlightEnterTracks: convertedTracks,
      })
    }
  } else {
    useBuilderStore.setState({ highlightEnterPct: 30, highlightEnterTracks: [] })
  }

  const kf = preset.keyframeTracks
  let phases: KeyframePhases
  if (kf && !isLegacyKeyframeTracks(kf)) {
    phases = kf
  } else {
    phases = synthesizeTracksFromPreset(preset)
  }

  // Rescale to the store's current fps so durations stay the same in seconds
  store.loadKeyframePhases(rescalePhases(phases, store.fps))
}

export function AnimationBuilderPage() {
  const { presets, loading, refresh: refreshPresets } = useAnimationPresets()

  const preset = useBuilderStore((s) => s.preset)
  const setPreset = useBuilderStore((s) => s.setPreset)
  const buildKeyframePhases = useBuilderStore((s) => s.buildKeyframePhases)
  const loadKeyframePhases = useBuilderStore((s) => s.loadKeyframePhases)
  const editMode = useBuilderStore((s) => s.editMode)
  const setEditMode = useBuilderStore((s) => s.setEditMode)
  const scope = useBuilderStore((s) => s.scope)
  const setScope = useBuilderStore((s) => s.setScope)
  const staggerFrames = useBuilderStore((s) => s.staggerFrames)
  const setStaggerFrames = useBuilderStore((s) => s.setStaggerFrames)
  const fps = useBuilderStore((s) => s.fps)
  const highlightEnterTracks = useBuilderStore((s) => s.highlightEnterTracks)
  const highlightEnterPct = useBuilderStore((s) => s.highlightEnterPct)

  const buildHighlightAnimation = useCallback(() => {
    if (highlightEnterTracks.length === 0) return undefined
    return { enterPct: highlightEnterPct, enterTracks: highlightEnterTracks }
  }, [highlightEnterPct, highlightEnterTracks])

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Filter presets by current edit mode
  const filteredPresets = useMemo(() => {
    if (editMode === 'highlight') return presets.filter(isHighlightPreset)
    if (editMode === 'hold') return presets.filter(isHoldPreset)
    return presets.filter(isEnterExitPreset)
  }, [presets, editMode])

  // Load the first preset on initial render
  const [hasInitialized, setHasInitialized] = useState(false)
  useEffect(() => {
    if (!hasInitialized && filteredPresets.length > 0) {
      loadPresetIntoStore(filteredPresets[0])
      setHasInitialized(true)
    }
  }, [filteredPresets, hasInitialized])

  // When mode changes, if current preset isn't in the filtered list, switch to the first one
  useEffect(() => {
    if (!hasInitialized || filteredPresets.length === 0) return
    if (preset && filteredPresets.some((p) => p.id === preset.id)) return
    loadPresetIntoStore(filteredPresets[0])
  }, [editMode, filteredPresets, preset, hasInitialized])

  // Preset selector change
  const handlePresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value
      const selected = presets.find((p) => p.id === id)
      if (selected) {
        loadPresetIntoStore(selected)
      }
    },
    [presets],
  )

  // Save — PUT to /api/presets/:id with KeyframePhases
  const handleSave = useCallback(async () => {
    if (!preset) return
    setSaving(true)
    setSaveError(null)
    try {
      const keyframeTracks = buildKeyframePhases()
      const res = await fetch(`/api/presets/${preset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyframeTracks,
          scope,
          highlightAnimation: buildHighlightAnimation(),
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Save failed (HTTP ${res.status}): ${text}`)
      }
      const updated = (await res.json()) as AnimationPreset
      setPreset(updated)
      refreshPresets()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [preset, scope, buildKeyframePhases, buildHighlightAnimation, setPreset, refreshPresets])

  // Save As — POST to create a new preset
  const handleSaveAs = useCallback(async () => {
    if (!preset) return
    const name = window.prompt('New preset name:', `${preset.name} (copy)`)
    if (!name || !name.trim()) return

    setSaving(true)
    setSaveError(null)
    try {
      const keyframeTracks = buildKeyframePhases()
      const body = {
        name: name.trim(),
        scope,
        enter: preset.enter,
        active: preset.active,
        exit: preset.exit,
        highlightAnimation: buildHighlightAnimation(),
        keyframeTracks,
      }
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Save As failed (HTTP ${res.status}): ${text}`)
      }
      const created = (await res.json()) as AnimationPreset
      loadPresetIntoStore(created)
      refreshPresets()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save As failed')
    } finally {
      setSaving(false)
    }
  }, [preset, scope, buildKeyframePhases, buildHighlightAnimation, refreshPresets])

  // New — clear builder state
  const handleNew = useCallback(() => {
    setPreset(null)
    loadKeyframePhases({
      fps: 30,
      enter: { durationFrames: 9, tracks: [] },
      active: { durationFrames: 30, tracks: [], cycleDurationFrames: 30 },
      exit: { durationFrames: 9, tracks: [] },
    })
    setSaveError(null)
  }, [setPreset, loadKeyframePhases])

  // Delete — DELETE /api/presets/:id (only user-created presets)
  const handleDelete = useCallback(async () => {
    if (!preset || preset.isBuiltin || saving) return
    if (!window.confirm(`Delete "${preset.name}"?`)) return

    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/presets/${preset.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Delete failed (HTTP ${res.status}): ${text}`)
      }
      setPreset(null)
      refreshPresets()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }, [preset, saving, setPreset, refreshPresets])

  const isBuiltin = preset?.isBuiltin ?? false
  const canSave = !!preset && !isBuiltin && !saving
  const canDelete = !!preset && !isBuiltin && !saving

  return (
    <div className="animation-builder-page">
      {/* Header */}
      <div className="animation-builder-page__header">
        {loading ? (
          <span className="animation-builder-page__loading">Loading presets...</span>
        ) : (
          <select
            className="animation-builder-page__preset-select"
            value={preset?.id ?? ''}
            onChange={handlePresetChange}
            aria-label="Select preset"
          >
            {!preset && <option value="">-- No preset selected --</option>}
            {filteredPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.isBuiltin ? ' (built-in)' : ''}
              </option>
            ))}
          </select>
        )}

        <div className="animation-builder-page__actions">
          <button
            className="animation-builder-page__btn animation-builder-page__btn--primary"
            onClick={() => void handleSave()}
            disabled={!canSave}
            title={isBuiltin ? 'Built-in presets cannot be overwritten' : undefined}
            type="button"
          >
            Save
          </button>
          <button
            className="animation-builder-page__btn animation-builder-page__btn--secondary"
            onClick={() => void handleSaveAs()}
            disabled={!preset || saving}
            type="button"
          >
            Save As
          </button>
          <button
            className="animation-builder-page__btn animation-builder-page__btn--secondary"
            onClick={handleNew}
            type="button"
          >
            New
          </button>
          <button
            className="animation-builder-page__btn animation-builder-page__btn--danger"
            onClick={() => void handleDelete()}
            disabled={!canDelete}
            title={isBuiltin ? 'Built-in presets cannot be deleted' : undefined}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Mode + scope toggles */}
      <div className="animation-builder-page__toggles-row">
        <div className="animation-builder-page__mode-toggle">
          <button
            type="button"
            className={`animation-builder-page__mode-btn${editMode === 'enter-exit' ? ' animation-builder-page__mode-btn--active' : ''}`}
            onClick={() => setEditMode('enter-exit')}
          >
            Enter / Exit
          </button>
          <button
            type="button"
            className={`animation-builder-page__mode-btn${editMode === 'hold' ? ' animation-builder-page__mode-btn--active' : ''}`}
            onClick={() => setEditMode('hold')}
          >
            Hold
          </button>
          <button
            type="button"
            className={`animation-builder-page__mode-btn${editMode === 'highlight' ? ' animation-builder-page__mode-btn--active' : ''}`}
            onClick={() => setEditMode('highlight')}
          >
            Highlight
          </button>
        </div>

        <div className="animation-builder-page__mode-toggle">
          <button
            type="button"
            className={`animation-builder-page__mode-btn${scope === 'phrase' ? ' animation-builder-page__mode-btn--active' : ''}`}
            onClick={() => setScope('phrase')}
          >
            Phrase
          </button>
          <button
            type="button"
            className={`animation-builder-page__mode-btn${scope === 'word' ? ' animation-builder-page__mode-btn--active' : ''}`}
            onClick={() => setScope('word')}
          >
            Word
          </button>
        </div>

        {scope === 'word' && (
          <label className="animation-builder-page__stagger-label">
            Delay
            <input
              type="number"
              className="animation-builder-page__stagger-input"
              value={staggerFrames}
              min={1}
              max={30}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v >= 1) setStaggerFrames(v)
              }}
              title={`${staggerFrames} frames (${(staggerFrames / fps).toFixed(2)}s) delay between each word`}
            />
            <span className="animation-builder-page__stagger-hint">f</span>
          </label>
        )}
      </div>

      {saveError && (
        <div className="animation-builder-page__error" role="alert">
          {saveError}
        </div>
      )}

      <div className="animation-builder-page__preview">
        <KeyframePreview />
      </div>

      <div className="animation-builder-page__timeline">
        <KeyframeTimeline />
      </div>
    </div>
  )
}
