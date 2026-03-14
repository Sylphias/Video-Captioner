import React, { useEffect, useState, useCallback } from 'react'
import type { AnimationPreset } from '@eigen/shared-types'
import { useAnimationPresets } from '../../hooks/useAnimationPresets'
import { useBuilderStore } from './useBuilderStore'
import { KeyframePreview } from './KeyframePreview'
import { KeyframeTimeline } from './KeyframeTimeline'
import './AnimationBuilderPage.css'

export function AnimationBuilderPage() {
  const { presets, loading } = useAnimationPresets()

  const preset = useBuilderStore((s) => s.preset)
  const setPreset = useBuilderStore((s) => s.setPreset)
  const keyframeTracks = useBuilderStore((s) => s.keyframeTracks)
  const setKeyframeTracks = useBuilderStore((s) => s.setKeyframeTracks)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load the first preset on initial render once presets are available
  const [hasInitialized, setHasInitialized] = useState(false)
  useEffect(() => {
    if (!hasInitialized && presets.length > 0) {
      const first = presets[0]
      setPreset(first)
      setKeyframeTracks(first.keyframeTracks ?? [])
      setHasInitialized(true)
    }
  }, [presets, hasInitialized, setPreset, setKeyframeTracks])

  // Preset selector change handler
  const handlePresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value
      const selected = presets.find((p) => p.id === id)
      if (selected) {
        setPreset(selected)
        setKeyframeTracks(selected.keyframeTracks ?? [])
      }
    },
    [presets, setPreset, setKeyframeTracks],
  )

  // Save — PUT to /api/presets/:id with updated keyframeTracks
  const handleSave = useCallback(async () => {
    if (!preset) return
    setSaving(true)
    setSaveError(null)
    try {
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
  }, [preset, keyframeTracks, setPreset])

  // Save As — POST to /api/presets to create a new preset
  const handleSaveAs = useCallback(async () => {
    if (!preset) return
    const name = window.prompt('New preset name:', `${preset.name} (copy)`)
    if (!name || !name.trim()) return

    setSaving(true)
    setSaveError(null)
    try {
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
      setPreset(created)
      setKeyframeTracks(created.keyframeTracks ?? [])
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save As failed')
    } finally {
      setSaving(false)
    }
  }, [preset, keyframeTracks, setPreset, setKeyframeTracks])

  // New — clear builder state to start fresh
  const handleNew = useCallback(() => {
    setPreset(null)
    setKeyframeTracks([])
    setSaveError(null)
  }, [setPreset, setKeyframeTracks])

  const isBuiltin = preset?.isBuiltin ?? false
  const canSave = !!preset && !isBuiltin && !saving

  return (
    <div className="animation-builder-page">
      {/* Header: preset selector + action buttons */}
      <div className="animation-builder-page__header">
        {loading ? (
          <span className="animation-builder-page__loading">Loading presets…</span>
        ) : (
          <select
            className="animation-builder-page__preset-select"
            value={preset?.id ?? ''}
            onChange={handlePresetChange}
            aria-label="Select preset"
          >
            {!preset && <option value="">— No preset selected —</option>}
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

      {/* Error message if save fails */}
      {saveError && (
        <div className="animation-builder-page__error" role="alert">
          {saveError}
        </div>
      )}

      {/* Main preview area */}
      <div className="animation-builder-page__preview">
        <KeyframePreview />
      </div>

      {/* Keyframe timeline — replaced placeholder with real timeline */}
      <div className="animation-builder-page__timeline">
        <KeyframeTimeline />
      </div>
    </div>
  )
}
