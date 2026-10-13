import { describe, it, expect, beforeEach } from 'vitest'
import { buildTextShadow } from '@eigen/remotion-composition'
import { useSubtitleStore, DEFAULT_STYLE } from '../store/subtitleStore.ts'
import { loadProjectBlob, type ProjectStateBlob } from './projectState.ts'

// The 16 style keys that existed before the shadowType field.
const LEGACY_STYLE = {
  highlightColor: '#FFFF00',
  baseColor: '#FFFFFF',
  fontSize: 64,
  fontFamily: 'Lilita One',
  fontWeight: 400,
  strokeColor: '#000000',
  strokeWidth: 3,
  shadowColor: '#000000',
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  shadowBlur: 4,
  letterSpacing: 0,
  wordSpacing: 0,
  verticalPosition: 80,
  lingerDuration: 0.4,
  laneGap: 8,
}

function blobWith(style: Record<string, unknown>, speakerStyles: Record<string, Record<string, unknown>> = {}): ProjectStateBlob {
  return {
    session: null,
    style,
    maxWordsPerPhrase: 5,
    speakerNames: {},
    speakerStyles,
    activeAnimationPresetId: null,
    activeHighlightPresetId: null,
    phraseAnimationPresetIds: {},
    laneCount: 2,
    laneLocks: {},
    phraseLaneOverrides: {},
    additionalSpeakerCount: 0,
    speakerHighlightDisabled: {},
    jobId: 'legacy-job',
    original: null,
    videoMetadata: null,
  }
}

// Pre-phase expression: 16-step ring at radius strokeWidth*2, then the drop shadow.
function legacyShadow(strokeWidth: number): string {
  const width = strokeWidth * 2
  const ring: string[] = []
  for (let i = 0; i < 16; i++) {
    const angle = (2 * Math.PI * i) / 16
    ring.push(`${(Math.cos(angle) * width).toFixed(1)}px ${(Math.sin(angle) * width).toFixed(1)}px 0 #000000`)
  }
  return `${ring.join(',')},0px 2px 4px #000000`
}

describe('loadProjectBlob legacy style safety', () => {
  beforeEach(() => {
    useSubtitleStore.setState({ style: { ...DEFAULT_STYLE }, speakerStyles: {} })
  })

  it('a pre-phase blob loads as Drop while keeping stored values', () => {
    loadProjectBlob(blobWith({ ...LEGACY_STYLE }))
    const { style } = useSubtitleStore.getState()
    expect(style.shadowType).toBe('drop')
    expect(style.fontSize).toBe(64)
    expect(style.strokeWidth).toBe(3)
  })

  it('fills other missing keys from DEFAULT_STYLE', () => {
    const { laneGap: _omit, ...withoutLaneGap } = LEGACY_STYLE
    loadProjectBlob(blobWith(withoutLaneGap))
    expect(useSubtitleStore.getState().style.laneGap).toBe(8)
  })

  it('keeps a stored extrude shadowType', () => {
    loadProjectBlob(blobWith({ ...LEGACY_STYLE, shadowType: 'extrude' }))
    expect(useSubtitleStore.getState().style.shadowType).toBe('extrude')
  })

  it('renders a legacy blob with the pre-phase text-shadow string', () => {
    loadProjectBlob(blobWith({ ...LEGACY_STYLE }))
    expect(buildTextShadow(useSubtitleStore.getState().style)).toBe(legacyShadow(3))
  })

  it('does not give speaker overrides a shadowType', () => {
    loadProjectBlob(blobWith({ ...LEGACY_STYLE }, { SPEAKER_00: { baseColor: '#00FF00' } }))
    expect(useSubtitleStore.getState().speakerStyles.SPEAKER_00).not.toHaveProperty('shadowType')
  })
})
