import type { AnimationPreset, TranscriptPhrase } from '@eigen/shared-types'

export interface StyleProps {
  highlightColor: string   // e.g. '#FFFF00'
  baseColor: string        // e.g. '#FFFFFF'
  fontSize: number         // px
  fontFamily: string
  fontWeight: number       // CSS font-weight: 300-900
  strokeColor: string      // e.g. '#000000' — outline color for text stroke
  strokeWidth: number      // px — 0 means no stroke
  shadowColor: string      // e.g. '#000000' — text shadow color
  shadowOffsetX: number    // px — horizontal shadow offset
  shadowOffsetY: number    // px — vertical shadow offset
  shadowBlur: number       // px — shadow blur radius (0 = sharp)
  verticalPosition: number // 0-100 percentage from top of frame
  lingerDuration: number   // seconds a phrase stays visible after last word ends
}

// SpeakerStyleOverride is now just a partial style override — no animation field.
// Animations are controlled via AnimationPreset, not per-speaker animation types.
export type SpeakerStyleOverride = Partial<StyleProps>

// Per-phrase type extending TranscriptPhrase with resolved animation preset.
// The frontend resolves preset IDs to full AnimationPreset objects before passing
// to the Remotion Player, because the composition runs in a serialization boundary
// and cannot access hooks/stores/APIs.
export type CompositionPhrase = TranscriptPhrase & {
  animationPreset?: AnimationPreset  // resolved per-phrase animation preset (takes priority over global)
}

export interface SubtitleCompositionProps {
  videoSrc: string                                      // HTTP URL e.g. /api/jobs/{jobId}/video
  phrases: CompositionPhrase[]
  style: StyleProps
  speakerStyles: Record<string, SpeakerStyleOverride>  // per-speaker style overrides keyed by speaker ID
  animationPreset?: AnimationPreset                     // global default animation preset for all phrases
  speakerLanes?: Record<string, { verticalPosition: number }>  // per-speaker fixed vertical position (optional for backward compat)
  overlapGap?: number      // % points between same-speaker stacked rows (default 8)
  maxVisibleRows?: number  // max simultaneous speaker rows visible (default 4)
  showSpeakerBorders?: boolean  // show colored borders per-speaker in preview (not in final render)
}
