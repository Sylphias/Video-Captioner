import { AbsoluteFill, OffthreadVideo } from 'remotion'
import type { SubtitleCompositionProps } from './types'
import { SubtitleOverlay } from './SubtitleOverlay'

export function SubtitleComposition({ videoSrc, words, style }: SubtitleCompositionProps) {
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={videoSrc}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      <AbsoluteFill>
        <SubtitleOverlay words={words} style={style} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
