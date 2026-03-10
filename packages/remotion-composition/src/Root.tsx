import React from 'react'
import { Composition } from 'remotion'
import { SubtitleComposition } from './SubtitleComposition'
import { COMPOSITION_ID } from './index'
import type { SubtitleCompositionProps } from './types'

const DEFAULT_PROPS: SubtitleCompositionProps = {
  videoSrc: '',
  phrases: [],
  style: {
    highlightColor: '#FFFF00',
    baseColor: '#FFFFFF',
    fontSize: 48,
    fontFamily: 'sans-serif',
    fontWeight: 700,
    strokeColor: '#000000',
    strokeWidth: 2,
    shadowColor: '#000000',
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    shadowBlur: 4,
    verticalPosition: 80,
    lingerDuration: 1.0,
  },
  speakerStyles: {},
}

export const RemotionRoot: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TypedComposition = Composition as any
  return (
    <TypedComposition
      id={COMPOSITION_ID}
      component={SubtitleComposition}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={DEFAULT_PROPS}
    />
  )
}
