import { create } from 'zustand'
import type { KeyframeTrack, KeyframeEasing, AnimationPreset, KeyframeableProperty } from '@eigen/shared-types'

type AspectRatio = '16:9' | '9:16' | '1:1'

interface BuilderState {
  // Preset being edited (loaded from API or new)
  preset: AnimationPreset | null
  setPreset: (p: AnimationPreset | null) => void

  // Keyframe tracks (working copy)
  keyframeTracks: KeyframeTrack[]
  setKeyframeTracks: (tracks: KeyframeTrack[]) => void
  addKeyframe: (property: KeyframeableProperty, time: number, value: number) => void
  removeKeyframe: (property: KeyframeableProperty, index: number) => void
  updateKeyframeValue: (property: KeyframeableProperty, index: number, value: number) => void
  updateKeyframeTime: (property: KeyframeableProperty, index: number, time: number) => void
  setTrackEasing: (property: KeyframeableProperty, segmentIndex: number, easing: KeyframeEasing) => void

  // Preview state
  aspectRatio: AspectRatio
  setAspectRatio: (ar: AspectRatio) => void
  sampleText: string
  setSampleText: (text: string) => void
  showMotionPath: boolean
  setShowMotionPath: (show: boolean) => void

  // Playhead (fraction 0-1 of phrase lifetime, synced from Player)
  playheadProgress: number
  setPlayheadProgress: (p: number) => void

  // Selection
  selectedProperty: KeyframeableProperty | null
  setSelectedProperty: (p: KeyframeableProperty | null) => void
  selectedKeyframeIndex: number | null
  setSelectedKeyframeIndex: (idx: number | null) => void
}

const DEFAULT_EASING: KeyframeEasing = { type: 'ease-in-out' }

export const useBuilderStore = create<BuilderState>((set) => ({
  // Preset
  preset: null,
  setPreset: (p) => set({ preset: p }),

  // Keyframe tracks
  keyframeTracks: [],
  setKeyframeTracks: (tracks) => set({ keyframeTracks: tracks }),

  addKeyframe: (property, time, value) =>
    set((state) => {
      const tracks = [...state.keyframeTracks]
      const idx = tracks.findIndex((t) => t.property === property)

      if (idx === -1) {
        // Create a new track with a single keyframe (no easings yet)
        tracks.push({ property, keyframes: [{ time, value }], easings: [] })
      } else {
        const track = tracks[idx]
        const keyframes = [...track.keyframes]
        const easings = [...track.easings]

        // Check if a keyframe already exists at this time (within tolerance)
        const existingIdx = keyframes.findIndex((kf) => Math.abs(kf.time - time) < 0.01)
        if (existingIdx !== -1) {
          // Update the existing keyframe's value in-place
          keyframes[existingIdx] = { ...keyframes[existingIdx], value }
          tracks[idx] = { ...track, keyframes, easings }
        } else {
          // Insert sorted by time
          const insertAt = keyframes.findIndex((kf) => kf.time > time)
          if (insertAt === -1) {
            // Append at end — add an easing for the new segment
            keyframes.push({ time, value })
            easings.push(DEFAULT_EASING)
          } else {
            // Insert in middle — add an easing for the new segment
            keyframes.splice(insertAt, 0, { time, value })
            easings.splice(insertAt, 0, DEFAULT_EASING)
          }
          tracks[idx] = { ...track, keyframes, easings }
        }
      }

      return { keyframeTracks: tracks }
    }),

  removeKeyframe: (property, index) =>
    set((state) => {
      const tracks = [...state.keyframeTracks]
      const idx = tracks.findIndex((t) => t.property === property)
      if (idx === -1) return {}

      const track = tracks[idx]
      const keyframes = [...track.keyframes]
      const easings = [...track.easings]

      keyframes.splice(index, 1)
      // Remove the corresponding easing segment
      const easingIdx = Math.min(index, easings.length - 1)
      if (easingIdx >= 0) {
        easings.splice(easingIdx, 1)
      }

      // If 0 or 1 keyframes remain, remove the entire track
      if (keyframes.length <= 1) {
        tracks.splice(idx, 1)
      } else {
        tracks[idx] = { ...track, keyframes, easings }
      }

      return { keyframeTracks: tracks }
    }),

  updateKeyframeValue: (property, index, value) =>
    set((state) => {
      const tracks = state.keyframeTracks.map((track) => {
        if (track.property !== property) return track
        const keyframes = [...track.keyframes]
        if (index < 0 || index >= keyframes.length) return track
        keyframes[index] = { ...keyframes[index], value }
        return { ...track, keyframes }
      })
      return { keyframeTracks: tracks }
    }),

  updateKeyframeTime: (property, index, time) =>
    set((state) => {
      const tracks = state.keyframeTracks.map((track) => {
        if (track.property !== property) return track
        const keyframes = [...track.keyframes]
        if (index < 0 || index >= keyframes.length) return track

        // Update the time
        keyframes[index] = { ...keyframes[index], time }

        // Re-sort keyframes by time, re-mapping easings to follow
        const paired = keyframes.map((kf, i) => ({ kf, easing: track.easings[i] }))
        paired.sort((a, b) => a.kf.time - b.kf.time)

        const sortedKeyframes = paired.map((p) => p.kf)
        // Rebuild easings: maintain length = keyframes.length - 1
        const sortedEasings = paired.slice(0, paired.length - 1).map((p) => p.easing ?? DEFAULT_EASING)

        return { ...track, keyframes: sortedKeyframes, easings: sortedEasings }
      })
      return { keyframeTracks: tracks }
    }),

  setTrackEasing: (property, segmentIndex, easing) =>
    set((state) => {
      const tracks = state.keyframeTracks.map((track) => {
        if (track.property !== property) return track
        const easings = [...track.easings]
        if (segmentIndex < 0 || segmentIndex >= easings.length) return track
        easings[segmentIndex] = easing
        return { ...track, easings }
      })
      return { keyframeTracks: tracks }
    }),

  // Preview state
  aspectRatio: '16:9',
  setAspectRatio: (ar) => set({ aspectRatio: ar }),
  sampleText: 'Sample subtitle text here',
  setSampleText: (text) => set({ sampleText: text }),
  showMotionPath: false,
  setShowMotionPath: (show) => set({ showMotionPath: show }),

  // Playhead
  playheadProgress: 0,
  setPlayheadProgress: (p) => set({ playheadProgress: p }),

  // Selection
  selectedProperty: null,
  setSelectedProperty: (p) => set({ selectedProperty: p }),
  selectedKeyframeIndex: null,
  setSelectedKeyframeIndex: (idx) => set({ selectedKeyframeIndex: idx }),
}))
