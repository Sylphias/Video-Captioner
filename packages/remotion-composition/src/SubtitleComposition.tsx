import { AbsoluteFill, Video, OffthreadVideo, useRemotionEnvironment } from 'remotion'
import type { SubtitleCompositionProps } from './types'
import { SubtitleOverlay } from './SubtitleOverlay'
import './fonts' // triggers module-level Google Font loading side effects

export function SubtitleComposition({ videoSrc, phrases, style, speakerStyles, animationPreset, showSpeakerBorders }: SubtitleCompositionProps) {
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
        <SubtitleOverlay
          phrases={phrases}
          style={style}
          speakerStyles={speakerStyles}
          animationPreset={animationPreset}
          showSpeakerBorders={!isRendering && showSpeakerBorders}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
