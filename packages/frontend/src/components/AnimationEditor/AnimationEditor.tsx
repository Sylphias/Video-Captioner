import { useState, useCallback, useEffect } from 'react'
import type { AnimationPreset, AnimationPhaseConfig, ActivePhaseConfig, HighlightKeyframeConfig } from '@eigen/shared-types'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import { useAnimationPresets } from '../../hooks/useAnimationPresets.ts'
import { useDebounced } from '../../hooks/useDebounced.ts'
import { PresetList } from './PresetList.tsx'
import { AnimationPreview } from './AnimationPreview.tsx'
import { PhaseTimeline } from './PhaseTimeline.tsx'
import { PhasePanel, HighlightPanel } from './PhasePanel.tsx'
import './AnimationEditor.css'

type SelectedPhase = 'enter' | 'active' | 'exit'

interface EditingParams {
  name: string
  scope: AnimationPreset['scope']
  enter: AnimationPhaseConfig
  active: ActivePhaseConfig
  exit: AnimationPhaseConfig & { mirrorEnter: boolean }
  highlightAnimation?: HighlightKeyframeConfig
}

const DEFAULT_ENTER: AnimationPhaseConfig = {
  type: 'fade',
  durationSec: 0.3,
  easing: 'ease-out',
  params: {},
}

const DEFAULT_ACTIVE: ActivePhaseConfig = {
  type: 'none',
  cycleDurationSec: 1.0,
  intensity: 0.5,
}

const DEFAULT_EXIT: AnimationPhaseConfig & { mirrorEnter: boolean } = {
  type: 'fade',
  durationSec: 0.3,
  easing: 'ease-in',
  params: {},
  mirrorEnter: false,
}

function buildDefaultParams(): EditingParams {
  return {
    name: 'New Preset',
    scope: 'phrase',
    enter: { ...DEFAULT_ENTER },
    active: { ...DEFAULT_ACTIVE },
    exit: { ...DEFAULT_EXIT },
  }
}

function presetToEditingParams(preset: AnimationPreset): EditingParams {
  return {
    name: preset.name,
    scope: preset.scope,
    enter: { ...preset.enter },
    active: { ...preset.active },
    exit: { ...preset.exit },
    highlightAnimation: preset.highlightAnimation ? { ...preset.highlightAnimation } : undefined,
  }
}

function editingParamsToPreset(params: EditingParams, base: AnimationPreset): AnimationPreset {
  // When mirrorEnter is true, exit uses enter's type/easing/params
  const exitConfig = params.exit.mirrorEnter
    ? { ...params.enter, durationSec: params.exit.durationSec, mirrorEnter: true }
    : { ...params.exit }

  return {
    ...base,
    name: params.name,
    scope: params.scope,
    enter: params.enter,
    active: params.active,
    exit: exitConfig,
    highlightAnimation: params.highlightAnimation,
  }
}

export function AnimationEditor() {
  const activeAnimationPresetId = useSubtitleStore((s) => s.activeAnimationPresetId)
  const setActiveAnimationPresetId = useSubtitleStore((s) => s.setActiveAnimationPresetId)

  const { presets, loading, createPreset, updatePreset, deletePreset, duplicatePreset } = useAnimationPresets()

  // Which preset is currently selected for editing (separate from active/applied preset)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  // Local editing state — changed by PhasePanel, debounced for preview
  const [editingParams, setEditingParams] = useState<EditingParams>(buildDefaultParams())
  // Which phase is selected in the timeline (drives PhasePanel content)
  const [selectedPhase, setSelectedPhase] = useState<SelectedPhase>('enter')

  // Debounce editing params before feeding to AnimationPreview (~300ms)
  const debouncedParams = useDebounced(editingParams, 300)

  // Select first preset by default once loaded
  useEffect(() => {
    if (presets.length > 0 && selectedPresetId === null) {
      const first = presets[0]
      setSelectedPresetId(first.id)
      setEditingParams(presetToEditingParams(first))
    }
  }, [presets, selectedPresetId])

  // When user selects a preset from the list, load its params into editing state
  const handleSelectPreset = useCallback((id: string) => {
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    setSelectedPresetId(id)
    setEditingParams(presetToEditingParams(preset))
  }, [presets])

  // Handle phase config changes from PhasePanel
  const handlePhaseConfigChange = useCallback((phase: SelectedPhase, config: unknown) => {
    setEditingParams((prev) => ({ ...prev, [phase]: config }))
  }, [])

  // "Set as default" — applies selected preset as the global active preset
  const handleSetAsDefault = useCallback(() => {
    if (selectedPresetId) {
      setActiveAnimationPresetId(selectedPresetId)
    }
  }, [selectedPresetId, setActiveAnimationPresetId])

  // "Save" — updates the selected custom preset with current editing params
  const handleSave = useCallback(async () => {
    if (!selectedPresetId) return
    const preset = presets.find((p) => p.id === selectedPresetId)
    if (!preset || preset.isBuiltin) return

    try {
      await updatePreset(selectedPresetId, {
        name: editingParams.name,
        scope: editingParams.scope,
        enter: editingParams.enter,
        active: editingParams.active,
        exit: editingParams.exit,
        highlightAnimation: editingParams.highlightAnimation ?? null,
        keyframeTracks: null,  // clear keyframe overrides — AnimationEditor uses declarative params
      })
    } catch (err) {
      console.error('[AnimationEditor] save failed:', err)
    }
  }, [selectedPresetId, presets, editingParams, updatePreset])

  // "Save as New" — creates a new custom preset from current editing params
  const handleSaveAsNew = useCallback(async () => {
    try {
      const created = await createPreset({
        name: editingParams.name + ' (copy)',
        scope: editingParams.scope,
        enter: editingParams.enter,
        active: editingParams.active,
        exit: editingParams.exit,
        highlightAnimation: editingParams.highlightAnimation,
      })
      setSelectedPresetId(created.id)
    } catch (err) {
      console.error('[AnimationEditor] save as new failed:', err)
    }
  }, [editingParams, createPreset])

  // "New Preset" — creates a brand-new default preset
  const handleCreateNew = useCallback(async () => {
    const defaults = buildDefaultParams()
    try {
      const created = await createPreset({
        name: defaults.name,
        scope: defaults.scope,
        enter: defaults.enter,
        active: defaults.active,
        exit: defaults.exit,
        highlightAnimation: defaults.highlightAnimation,
      })
      setSelectedPresetId(created.id)
      setEditingParams(defaults)
    } catch (err) {
      console.error('[AnimationEditor] create failed:', err)
    }
  }, [createPreset])

  // "Duplicate" — duplicates an existing preset
  const handleDuplicate = useCallback(async (id: string) => {
    try {
      const duplicated = await duplicatePreset(id)
      setSelectedPresetId(duplicated.id)
      setEditingParams(presetToEditingParams(duplicated))
    } catch (err) {
      console.error('[AnimationEditor] duplicate failed:', err)
    }
  }, [duplicatePreset])

  // "Delete" — removes a custom preset
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deletePreset(id)
      // If the deleted preset was selected, clear selection
      if (selectedPresetId === id) {
        const remaining = presets.filter((p) => p.id !== id)
        if (remaining.length > 0) {
          setSelectedPresetId(remaining[0].id)
          setEditingParams(presetToEditingParams(remaining[0]))
        } else {
          setSelectedPresetId(null)
        }
      }
    } catch (err) {
      console.error('[AnimationEditor] delete failed:', err)
    }
  }, [deletePreset, selectedPresetId, presets])

  // Build a preview AnimationPreset from debounced editing params
  const previewPreset: AnimationPreset | null = (() => {
    if (!selectedPresetId && presets.length === 0) return null
    const base = presets.find((p) => p.id === selectedPresetId) ?? presets[0] ?? null
    if (!base) return null
    return editingParamsToPreset(debouncedParams, base)
  })()

  // Determine if the selected preset is a builtin (controls Save button visibility)
  const selectedPreset = presets.find((p) => p.id === selectedPresetId) ?? null
  const isBuiltin = selectedPreset?.isBuiltin ?? true

  // Phase durations for timeline
  const totalDuration = 3.0
  const enterDuration = editingParams.enter.durationSec
  const exitDuration = editingParams.exit.durationSec
  const activeDuration = Math.max(0.1, totalDuration - enterDuration - exitDuration)

  return (
    <div className="animation-editor">
      {/* Left sidebar: searchable preset list */}
      <div className="animation-editor__sidebar">
        {loading ? (
          <div className="animation-editor__loading">Loading presets...</div>
        ) : (
          <PresetList
            presets={presets}
            selectedId={selectedPresetId}
            activeGlobalId={activeAnimationPresetId}
            onSelect={handleSelectPreset}
            onCreate={handleCreateNew}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Right main area */}
      <div className="animation-editor__main">
        {selectedPreset ? (
          <>
            {/* Preset name + action buttons */}
            <div className="animation-editor__top-bar">
              <input
                className="animation-editor__name-input"
                type="text"
                value={editingParams.name}
                onChange={(e) => setEditingParams((prev) => ({ ...prev, name: e.target.value }))}
                disabled={isBuiltin}
                title={isBuiltin ? 'Built-in presets cannot be renamed' : 'Preset name'}
              />
              <div className="animation-editor__actions">
                <button
                  className={[
                    'animation-editor__action-btn',
                    selectedPresetId === activeAnimationPresetId
                      ? 'animation-editor__action-btn--active'
                      : '',
                  ].join(' ').trim()}
                  type="button"
                  onClick={handleSetAsDefault}
                  title="Set as global default"
                >
                  {selectedPresetId === activeAnimationPresetId ? 'Default' : 'Set Default'}
                </button>
                {!isBuiltin && (
                  <button
                    className="animation-editor__action-btn"
                    type="button"
                    onClick={() => void handleSave()}
                  >
                    Save
                  </button>
                )}
                <button
                  className="animation-editor__action-btn"
                  type="button"
                  onClick={() => void handleSaveAsNew()}
                >
                  Save as New
                </button>
              </div>
            </div>

            {/* Live animation preview */}
            <AnimationPreview preset={previewPreset} />

            {/* Three-phase visual timeline */}
            <PhaseTimeline
              enterDuration={enterDuration}
              activeDuration={activeDuration}
              exitDuration={exitDuration}
              totalDuration={totalDuration}
              selectedPhase={selectedPhase}
              onSelectPhase={setSelectedPhase}
              onEnterDurationChange={(sec) =>
                setEditingParams((prev) => ({
                  ...prev,
                  enter: { ...prev.enter, durationSec: sec },
                }))
              }
              onExitDurationChange={(sec) =>
                setEditingParams((prev) => ({
                  ...prev,
                  exit: { ...prev.exit, durationSec: sec },
                }))
              }
            />

            {/* Phase parameter panel */}
            <PhasePanel
              phase={selectedPhase}
              config={
                selectedPhase === 'enter'
                  ? editingParams.enter
                  : selectedPhase === 'active'
                  ? editingParams.active
                  : editingParams.exit
              }
              scope={editingParams.scope}
              onConfigChange={(config) => handlePhaseConfigChange(selectedPhase, config)}
              onScopeChange={(scope) => setEditingParams((prev) => ({ ...prev, scope }))}
            />

            {/* Highlight (karaoke) animation */}
            <HighlightPanel
              highlight={editingParams.highlightAnimation}
              onChange={(hl) => setEditingParams((prev) => ({ ...prev, highlightAnimation: hl }))}
            />
          </>
        ) : (
          <div className="animation-editor__no-selection">
            <p>Select a preset from the list to edit it, or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  )
}
