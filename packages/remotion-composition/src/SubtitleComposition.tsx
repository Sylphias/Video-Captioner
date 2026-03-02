import { AbsoluteFill, Video } from 'remotion'
import type { SubtitleCompositionProps } from './types'
import { SubtitleOverlay } from './SubtitleOverlay'

export function SubtitleComposition({ videoSrc, phrases, style }: SubtitleCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <AbsoluteFill>
        <Video src={videoSrc} />
      </AbsoluteFill>
      <AbsoluteFill>
        <SubtitleOverlay phrases={phrases} style={style} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
