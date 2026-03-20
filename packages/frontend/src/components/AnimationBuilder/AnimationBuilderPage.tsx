import React, { useEffect, useState, useCallback } from 'react'
import type { AnimationPreset, KeyframePhases } from '@eigen/shared-types'
import { isLegacyKeyframeTracks } from '@eigen/shared-types'
import { useAnimationPresets } from '../../hooks/useAnimationPresets'
import { useBuilderStore } from './useBuilderStore'
import { KeyframePreview } from './KeyframePreview'
import { KeyframeTimeline } from './KeyframeTimeline'
import { KeyframeDrawer } from './KeyframeDrawer'
import './AnimationBuilderPage.css'

/** Load keyframe phases from a preset into the builder store. */
function loadPresetIntoStore(preset: AnimationPreset) {
  const store = useBuilderStore.getState()
  store.setPreset(preset)

  const kf = preset.keyframeTracks
  if (kf && !isLegacyKeyframeTracks(kf)) {
    // New KeyframePhases format
    store.loadKeyframePhases(kf)
  } else {
    // Legacy or no keyframe tracks — reset to defaults
    store.loadKeyframePhases({
      fps: 30,
      enter: { durationFrames: 9, tracks: [] },
      active: { durationFrames: 30, tracks: [], cycleDurationFrames: 30 },
      exit: { durationFrames: 9, tracks: [] },
    })
  }
}

export function AnimationBuilderPage() {
  const { presets, loading } = useAnimationPresets()

  const preset = useBuilderStore((s) => s.preset)
  const setPreset = useBuilderStore((s) => s.setPreset)
  const buildKeyframePhases = useBuilderStore((s) => s.buildKeyframePhases)
  const loadKeyframePhases = useBuilderStore((s) => s.loadKeyframePhases)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load the first preset on initial render
  const [hasInitialized, setHasInitialized] = useState(false)
  useEffect(() => {
    if (!hasInitialized && presets.length > 0) {
      loadPresetIntoStore(presets[0])
      setHasInitialized(true)
    }
  }, [presets, hasInitialized])

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
        body: JSON.stringify({ keyframeTracks }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Save failed (HTTP ${res.status}): ${text}`)
      }
      const updated = (await res.json()) as AnimationPreset
      setPreset(updated)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [preset, buildKeyframePhases, setPreset])

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
        scope: preset.scope,
        enter: preset.enter,
        active: preset.active,
        exit: preset.exit,
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
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save As failed')
    } finally {
      setSaving(false)
    }
  }, [preset, buildKeyframePhases])

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

  const isBuiltin = preset?.isBuiltin ?? false
  const canSave = !!preset && !isBuiltin && !saving

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
            {presets.map((p) => (
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
        </div>
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

      <KeyframeDrawer />
    </div>
  )
}
