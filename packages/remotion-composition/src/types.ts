import type { TranscriptWord } from '@eigen/shared-types'

export interface StyleProps {
  highlightColor: string   // e.g. '#FFFF00'
  baseColor: string        // e.g. '#FFFFFF'
  fontSize: number         // px
  fontFamily: string
}

export interface SubtitleCompositionProps {
  videoSrc: string                    // HTTP URL e.g. /api/jobs/{jobId}/video
  words: TranscriptWord[]
  style: StyleProps
}
