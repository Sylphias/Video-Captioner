import type { TranscriptPhrase } from '@eigen/shared-types'

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

export type AnimationType = 'none' | 'pop' | 'slide-up' | 'bounce'

export type SpeakerStyleOverride = Partial<StyleProps> & { animationType?: AnimationType }

export interface SubtitleCompositionProps {
  videoSrc: string                                      // HTTP URL e.g. /api/jobs/{jobId}/video
  phrases: TranscriptPhrase[]
  style: StyleProps
  speakerStyles: Record<string, SpeakerStyleOverride>  // per-speaker style overrides keyed by speaker ID
}
