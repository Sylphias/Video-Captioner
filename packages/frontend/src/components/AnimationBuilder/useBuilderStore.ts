import { create } from 'zustand'
import type { KeyframeTrack, KeyframeEasing, AnimationPreset, KeyframeableProperty, KeyframeFps, KeyframePhases } from '@eigen/shared-types'
import { isLegacyKeyframeTracks } from '@eigen/shared-types'

type AspectRatio = '16:9' | '9:16' | '1:1'
type PhaseName = 'enter' | 'active' | 'exit'

interface BuilderState {
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
}

const DEFAULT_EASING: KeyframeEasing = { type: 'ease-in-out' }

// Phase-track field keys mapped by phase name
const PHASE_TRACK_KEYS: Record<PhaseName, 'enterTracks' | 'activeTracks' | 'exitTracks'> = {
  enter: 'enterTracks',
  active: 'activeTracks',
  exit: 'exitTracks',
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
  // Preset
  preset: null,
  setPreset: (p) => set({ preset: p }),

  // Phase-based keyframe state
  fps: 30,
  setFps: (fps) => set({ fps }),

  selectedPhase: 'enter',
  setSelectedPhase: (phase) => set({ selectedPhase: phase }),

  enterDurationFrames: 9,    // 0.3s @ 30fps
  setEnterDurationFrames: (frames) => set({ enterDurationFrames: frames }),
  activeCycleDurationFrames: 30,  // 1s @ 30fps
  setActiveCycleDurationFrames: (frames) => set({ activeCycleDurationFrames: frames }),
  exitDurationFrames: 9,     // 0.3s @ 30fps
  setExitDurationFrames: (frames) => set({ exitDurationFrames: frames }),

  enterTracks: [],
  activeTracks: [],
  exitTracks: [],

  currentPhaseTracks: () => {
    const state = get()
    return state[PHASE_TRACK_KEYS[state.selectedPhase]]
  },

  currentPhaseDurationFrames: () => {
    const state = get()
    switch (state.selectedPhase) {
      case 'enter': return state.enterDurationFrames
      case 'active': return state.activeCycleDurationFrames
      case 'exit': return state.exitDurationFrames
    }
  },

  addKeyframe: (property, time, value) =>
    set((state) => {
      const trackKey = PHASE_TRACK_KEYS[state.selectedPhase]
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
    }),

  removeKeyframe: (property, index) =>
    set((state) => {
      const trackKey = PHASE_TRACK_KEYS[state.selectedPhase]
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
    }),

  updateKeyframeValue: (property, index, value) =>
    set((state) => {
      const trackKey = PHASE_TRACK_KEYS[state.selectedPhase]
      const tracks = state[trackKey].map((track) => {
        if (track.property !== property) return track
        const keyframes = [...track.keyframes]
        if (index < 0 || index >= keyframes.length) return track
        keyframes[index] = { ...keyframes[index], value }
        return { ...track, keyframes }
      })
      return { [trackKey]: tracks }
    }),

  updateKeyframeTime: (property, index, time) =>
    set((state) => {
      const trackKey = PHASE_TRACK_KEYS[state.selectedPhase]
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
    }),

  setTrackEasing: (property, segmentIndex, easing) =>
    set((state) => {
      const trackKey = PHASE_TRACK_KEYS[state.selectedPhase]
      const tracks = state[trackKey].map((track) => {
        if (track.property !== property) return track
        const easings = [...track.easings]
        if (segmentIndex < 0 || segmentIndex >= easings.length) return track
        easings[segmentIndex] = easing
        return { ...track, easings }
      })
      return { [trackKey]: tracks }
    }),

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

  loadKeyframePhases: (phases) =>
    set({
      fps: phases.fps,
      enterDurationFrames: phases.enter.durationFrames,
      activeCycleDurationFrames: phases.active.cycleDurationFrames,
      exitDurationFrames: phases.exit.durationFrames,
      enterTracks: phases.enter.tracks,
      activeTracks: phases.active.tracks,
      exitTracks: phases.exit.tracks,
    }),

  // Preview state
  aspectRatio: '16:9',
  setAspectRatio: (ar) => set({ aspectRatio: ar }),
  sampleText: 'Sample subtitle text here',
  setSampleText: (text) => set({ sampleText: text }),
  showMotionPath: false,
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
}))
