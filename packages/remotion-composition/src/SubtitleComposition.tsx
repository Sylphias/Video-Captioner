import { AbsoluteFill, Video } from 'remotion'
import type { SubtitleCompositionProps } from './types'
import { SubtitleOverlay } from './SubtitleOverlay'

export function SubtitleComposition({ videoSrc, words, style }: SubtitleCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <AbsoluteFill>
        <Video src={videoSrc} />
      </AbsoluteFill>
      <AbsoluteFill>
        <SubtitleOverlay words={words} style={style} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
