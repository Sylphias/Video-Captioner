import { AbsoluteFill, Video, OffthreadVideo, useRemotionEnvironment } from 'remotion'
import type { SubtitleCompositionProps } from './types'
import { SubtitleOverlay } from './SubtitleOverlay'

export function SubtitleComposition({ videoSrc, phrases, style }: SubtitleCompositionProps) {
  const { isRendering } = useRemotionEnvironment()

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <AbsoluteFill>
        {isRendering ? (
          <OffthreadVideo src={videoSrc} />
        ) : (
          <Video src={videoSrc} />
        )}
      </AbsoluteFill>
      <AbsoluteFill>
        <SubtitleOverlay phrases={phrases} style={style} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
