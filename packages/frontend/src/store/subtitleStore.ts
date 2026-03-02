import { create } from 'zustand'
import type { Transcript, VideoMetadata } from '@eigen/shared-types'
import type { StyleProps } from '@eigen/remotion-composition'

interface SubtitleStore {
  jobId: string | null
  transcript: Transcript | null
  videoMetadata: VideoMetadata | null
  style: StyleProps
  setJob: (jobId: string, transcript: Transcript, videoMetadata: VideoMetadata) => void
  setStyle: (style: Partial<StyleProps>) => void
  reset: () => void
}

const DEFAULT_STYLE: StyleProps = {
  highlightColor: '#FFFF00',
  baseColor: '#FFFFFF',
  fontSize: 48,
  fontFamily: 'Arial, sans-serif',
}

export const useSubtitleStore = create<SubtitleStore>((set) => ({
  jobId: null,
  transcript: null,
  videoMetadata: null,
  style: DEFAULT_STYLE,
  setJob: (jobId, transcript, videoMetadata) => set({ jobId, transcript, videoMetadata }),
  setStyle: (partial) => set((state) => ({ style: { ...state.style, ...partial } })),
  reset: () => set({ jobId: null, transcript: null, videoMetadata: null, style: DEFAULT_STYLE }),
}))
