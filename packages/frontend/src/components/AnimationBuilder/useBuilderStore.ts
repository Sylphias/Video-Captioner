import { create } from 'zustand'
import type { KeyframeTrack, KeyframeEasing, AnimationPreset, KeyframeableProperty, KeyframeFps, KeyframePhases, AnimationScope } from '@eigen/shared-types'
import { isLegacyKeyframeTracks } from '@eigen/shared-types'

type AspectRatio = '16:9' | '9:16' | '1:1'
type PhaseName = 'enter' | 'active' | 'exit'
type EditMode = 'enter-exit' | 'hold' | 'highlight'

interface BuilderState {
  // Edit mode: enter/exit animations vs hold (active cycle) animations
  editMode: EditMode
  setEditMode: (mode: EditMode) => void

  // Animation scope: phrase (all words together) or word (staggered)
  scope: AnimationScope
  setScope: (scope: AnimationScope) => void
  staggerFrames: number
  setStaggerFrames: (frames: number) => void

  // Highlight animation (percentage-based keyframes, 0-100)
  highlightEnterTracks: KeyframeTrack[]
  highlightEnterPct: number   // 0-100: what % of word duration is the enter transition
  setHighlightEnterPct: (pct: number) => void

  // Preset being edited (loaded from API or new)
  preset: AnimationPreset | null
  setPreset: (p: AnimationPreset | null) => void

  // ─── Phase-based keyframe state ──────────────────────────────────────────────
  fps: KeyframeFps
  setFps: (fps: KeyframeFps) => void

  selectedPhase: PhaseName
  setSelectedPhase: (phase: PhaseName) => void

  enterDurationFrames: number
  setEnterDurationFrames: (frames: number) => void
  activeCycleDurationFrames: number
  setActiveCycleDurationFrames: (frames: number) => void
  exitDurationFrames: number
  setExitDurationFrames: (frames: number) => void

  enterTracks: KeyframeTrack[]
  activeTracks: KeyframeTrack[]
  exitTracks: KeyframeTrack[]

  // All keyframe actions operate on the selectedPhase's tracks
  addKeyframe: (property: KeyframeableProperty, time: number, value: number) => void
  removeKeyframe: (property: KeyframeableProperty, index: number) => void
  updateKeyframeValue: (property: KeyframeableProperty, index: number, value: number) => void
  updateKeyframeTime: (property: KeyframeableProperty, index: number, time: number) => void
  setTrackEasing: (property: KeyframeableProperty, segmentIndex: number, easing: KeyframeEasing) => void

  // Build the complete KeyframePhases for save/preview
  buildKeyframePhases: () => KeyframePhases
  // Load from a KeyframePhases (e.g. when selecting a preset)
  loadKeyframePhases: (phases: KeyframePhases) => void

  // Helper to get current phase's tracks
  currentPhaseTracks: () => KeyframeTrack[]
  currentPhaseDurationFrames: () => number

  // Preview state
  aspectRatio: AspectRatio
  setAspectRatio: (ar: AspectRatio) => void
  sampleText: string
  setSampleText: (text: string) => void
  showMotionPath: boolean
  setShowMotionPath: (show: boolean) => void

  // Playhead (frame within current phase, synced from Player)
  playheadFrame: number
  setPlayheadFrame: (f: number) => void

  // Selection
  selectedProperty: KeyframeableProperty | null
  setSelectedProperty: (p: KeyframeableProperty | null) => void
  selectedKeyframeIndex: number | null
  setSelectedKeyframeIndex: (idx: number | null) => void

  // Seek callback — registered by KeyframePreview, called by timeline to seek the Player
  seekToPhaseFrame: ((phaseFrame: number) => void) | null
  setSeekToPhaseFrame: (cb: ((phaseFrame: number) => void) | null) => void

  // Undo / Redo
  undo: () => void
  redo: () => void
}

// ─── Undo / Redo ──────────────────────────────────────────────────────────────

interface BuilderSnapshot {
  scope: AnimationScope
  staggerFrames: number
  highlightEnterTracks: KeyframeTrack[]
  highlightEnterPct: number
  fps: KeyframeFps
  enterDurationFrames: number
  activeCycleDurationFrames: number
  exitDurationFrames: number
  enterTracks: KeyframeTrack[]
  activeTracks: KeyframeTrack[]
  exitTracks: KeyframeTrack[]
}

const MAX_UNDO = 50
let undoStack: BuilderSnapshot[] = []
let redoStack: BuilderSnapshot[] = []

function captureSnapshot(state: BuilderState): BuilderSnapshot {
  return {
    scope: state.scope,
    staggerFrames: state.staggerFrames,
    highlightEnterTracks: state.highlightEnterTracks,
    highlightEnterPct: state.highlightEnterPct,
    fps: state.fps,
    enterDurationFrames: state.enterDurationFrames,
    activeCycleDurationFrames: state.activeCycleDurationFrames,
    exitDurationFrames: state.exitDurationFrames,
    enterTracks: state.enterTracks,
    activeTracks: state.activeTracks,
    exitTracks: state.exitTracks,
  }
}

function pushUndo(state: BuilderState) {
  undoStack.push(captureSnapshot(state))
  if (undoStack.length > MAX_UNDO) undoStack.shift()
  redoStack = []
}

const DEFAULT_EASING: KeyframeEasing = { type: 'ease-in-out' }

// Phase-track field keys mapped by phase name
const PHASE_TRACK_KEYS: Record<PhaseName, 'enterTracks' | 'activeTracks' | 'exitTracks'> = {
  enter: 'enterTracks',
  active: 'activeTracks',
  exit: 'exitTracks',
}

type TrackKey = 'enterTracks' | 'activeTracks' | 'exitTracks' | 'highlightEnterTracks'

/** Get the correct track key based on edit mode */
function getTrackKey(state: { editMode: EditMode; selectedPhase: PhaseName }): TrackKey {
  if (state.editMode === 'highlight') return 'highlightEnterTracks'
  return PHASE_TRACK_KEYS[state.selectedPhase]
}

function modifyTracks(
  tracks: KeyframeTrack[],
  property: KeyframeableProperty,
  modifier: (track: KeyframeTrack) => KeyframeTrack | null,
): KeyframeTrack[] {
  const idx = tracks.findIndex((t) => t.property === property)
  if (idx === -1) return tracks
  const result = [...tracks]
  const modified = modifier(result[idx])
  if (modified === null) {
    result.splice(idx, 1)
  } else {
    result[idx] = modified
  }
  return result
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  // Edit mode
  editMode: 'enter-exit',
  setEditMode: (mode) => set((state) => {
    const update: Partial<BuilderState> = { editMode: mode }
    if (mode === 'hold') {
      update.selectedPhase = 'active'
    } else if (mode === 'enter-exit' || mode === 'highlight') {
      if (state.selectedPhase === 'active') update.selectedPhase = 'enter'
    }
    return update
  }),

  // Animation scope
  scope: 'phrase' as AnimationScope,
  setScope: (scope) => set({ scope }),
  staggerFrames: 3,
  setStaggerFrames: (frames) => { pushUndo(get()); set({ staggerFrames: frames }) },

  // Highlight animation (percentage-based, 0-100)
  highlightEnterTracks: [],
  highlightEnterPct: 30,  // 30% of word duration for enter transition
  setHighlightEnterPct: (pct) => { pushUndo(get()); set({ highlightEnterPct: pct }) },

  // Preset
  preset: null,
  setPreset: (p) => set({ preset: p }),

  // Phase-based keyframe state
  fps: 30,
  setFps: (fps) => { pushUndo(get()); set({ fps }) },

  selectedPhase: 'enter',
  setSelectedPhase: (phase) => {
    const state = get()
    // Guard: reject phases invalid for current mode
    if (state.editMode === 'hold' && phase !== 'active') return
    if (state.editMode === 'enter-exit' && phase === 'active') return
    if (state.editMode === 'highlight' && phase !== 'enter') return
    set({ selectedPhase: phase })
  },

  enterDurationFrames: 9,    // 0.3s @ 30fps
  setEnterDurationFrames: (frames) => { pushUndo(get()); set({ enterDurationFrames: frames }) },
  activeCycleDurationFrames: 30,  // 1s @ 30fps
  setActiveCycleDurationFrames: (frames) => { pushUndo(get()); set({ activeCycleDurationFrames: frames }) },
  exitDurationFrames: 9,     // 0.3s @ 30fps
  setExitDurationFrames: (frames) => { pushUndo(get()); set({ exitDurationFrames: frames }) },

  enterTracks: [],
  activeTracks: [],
  exitTracks: [],

  currentPhaseTracks: () => {
    const state = get()
    if (state.editMode === 'highlight') return state.highlightEnterTracks
    return state[getTrackKey(state)]
  },

  currentPhaseDurationFrames: () => {
    const state = get()
    if (state.editMode === 'highlight') return 100  // percentage scale 0-100
    switch (state.selectedPhase) {
      case 'enter': return state.enterDurationFrames
      case 'active': return state.activeCycleDurationFrames
      case 'exit': return state.exitDurationFrames
    }
  },

  addKeyframe: (property, time, value) => {
    pushUndo(get())
    set((state) => {
      const trackKey = getTrackKey(state)
      const tracks = [...state[trackKey]]
      const idx = tracks.findIndex((t) => t.property === property)

      if (idx === -1) {
        tracks.push({ property, keyframes: [{ time, value }], easings: [] })
      } else {
        const track = tracks[idx]
        const keyframes = [...track.keyframes]
        const easings = [...track.easings]

        const existingIdx = keyframes.findIndex((kf) => Math.abs(kf.time - time) < 0.5)
        if (existingIdx !== -1) {
          keyframes[existingIdx] = { ...keyframes[existingIdx], value }
          tracks[idx] = { ...track, keyframes, easings }
        } else {
          const insertAt = keyframes.findIndex((kf) => kf.time > time)
          if (insertAt === -1) {
            keyframes.push({ time, value })
            easings.push(DEFAULT_EASING)
          } else {
            keyframes.splice(insertAt, 0, { time, value })
            easings.splice(insertAt, 0, DEFAULT_EASING)
          }
          tracks[idx] = { ...track, keyframes, easings }
        }
      }

      return { [trackKey]: tracks }
    })
  },

  removeKeyframe: (property, index) => {
    pushUndo(get())
    set((state) => {
      const trackKey = getTrackKey(state)
      const tracks = modifyTracks(state[trackKey], property, (track) => {
        const keyframes = [...track.keyframes]
        const easings = [...track.easings]
        keyframes.splice(index, 1)
        const easingIdx = Math.min(index, easings.length - 1)
        if (easingIdx >= 0) easings.splice(easingIdx, 1)
        if (keyframes.length <= 1) return null
        return { ...track, keyframes, easings }
      })
      return { [trackKey]: tracks }
    })
  },

  updateKeyframeValue: (property, index, value) => {
    pushUndo(get())
    set((state) => {
      const trackKey = getTrackKey(state)
      const tracks = state[trackKey].map((track) => {
        if (track.property !== property) return track
        const keyframes = [...track.keyframes]
        if (index < 0 || index >= keyframes.length) return track
        keyframes[index] = { ...keyframes[index], value }
        return { ...track, keyframes }
      })
      return { [trackKey]: tracks }
    })
  },

  updateKeyframeTime: (property, index, time) => {
    pushUndo(get())
    set((state) => {
      const trackKey = getTrackKey(state)
      const tracks = state[trackKey].map((track) => {
        if (track.property !== property) return track
        const keyframes = [...track.keyframes]
        if (index < 0 || index >= keyframes.length) return track

        keyframes[index] = { ...keyframes[index], time }

        const paired = keyframes.map((kf, i) => ({ kf, easing: track.easings[i] }))
        paired.sort((a, b) => a.kf.time - b.kf.time)

        const sortedKeyframes = paired.map((p) => p.kf)
        const sortedEasings = paired.slice(0, paired.length - 1).map((p) => p.easing ?? DEFAULT_EASING)

        return { ...track, keyframes: sortedKeyframes, easings: sortedEasings }
      })
      return { [trackKey]: tracks }
    })
  },

  setTrackEasing: (property, segmentIndex, easing) => {
    pushUndo(get())
    set((state) => {
      const trackKey = getTrackKey(state)
      const tracks = state[trackKey].map((track) => {
        if (track.property !== property) return track
        const easings = [...track.easings]
        if (segmentIndex < 0 || segmentIndex >= easings.length) return track
        easings[segmentIndex] = easing
        return { ...track, easings }
      })
      return { [trackKey]: tracks }
    })
  },

  buildKeyframePhases: (): KeyframePhases => {
    const state = get()
    return {
      fps: state.fps,
      enter: {
        durationFrames: state.enterDurationFrames,
        tracks: state.enterTracks,
      },
      active: {
        durationFrames: state.activeCycleDurationFrames,
        tracks: state.activeTracks,
        cycleDurationFrames: state.activeCycleDurationFrames,
      },
      exit: {
        durationFrames: state.exitDurationFrames,
        tracks: state.exitTracks,
      },
    }
  },

  loadKeyframePhases: (phases) => {
    // Loading a preset clears undo history
    undoStack = []
    redoStack = []
    set({
      fps: phases.fps,
      enterDurationFrames: phases.enter.durationFrames,
      activeCycleDurationFrames: phases.active.cycleDurationFrames,
      exitDurationFrames: phases.exit.durationFrames,
      enterTracks: phases.enter.tracks,
      activeTracks: phases.active.tracks,
      exitTracks: phases.exit.tracks,
    })
  },

  // Preview state
  aspectRatio: '16:9',
  setAspectRatio: (ar) => set({ aspectRatio: ar }),
  sampleText: 'Sample subtitle text here',
  setSampleText: (text) => set({ sampleText: text }),
  showMotionPath: true,
  setShowMotionPath: (show) => set({ showMotionPath: show }),

  // Playhead (frame within current phase)
  playheadFrame: 0,
  setPlayheadFrame: (f) => set({ playheadFrame: f }),

  // Selection
  selectedProperty: null,
  setSelectedProperty: (p) => set({ selectedProperty: p }),
  selectedKeyframeIndex: null,
  setSelectedKeyframeIndex: (idx) => set({ selectedKeyframeIndex: idx }),

  // Seek callback
  seekToPhaseFrame: null,
  setSeekToPhaseFrame: (cb) => set({ seekToPhaseFrame: cb }),

  // Undo / Redo
  undo: () => {
    const snapshot = undoStack.pop()
    if (!snapshot) return
    redoStack.push(captureSnapshot(get()))
    set(snapshot)
  },
  redo: () => {
    const snapshot = redoStack.pop()
    if (!snapshot) return
    undoStack.push(captureSnapshot(get()))
    set(snapshot)
  },
}))
