import { describe, it, expect, beforeEach } from 'vitest'
import { LOOK_STYLE_KEYS, pickLookProps } from '@eigen/remotion-composition'
import type { LookStyleProps, StyleProps } from '@eigen/remotion-composition'
import type { Transcript, VideoMetadata } from '@eigen/shared-types'
import { useSubtitleStore, DEFAULT_STYLE } from '../store/subtitleStore.ts'
import { useUndoStore } from '../store/undoMiddleware.ts'
import { applyLookStyle, buildSaveAsStylePayload } from './applyStyle.ts'

const MOCK_VIDEO_METADATA: VideoMetadata = {
  duration: 6,
  fps: 30,
  width: 1920,
  height: 1080,
  codec: 'h264',
}

// 12 words: SPEAKER_00 says 0-5, SPEAKER_01 says 6-11
function buildTranscript(): Transcript {
  const words = Array.from({ length: 12 }, (_, i) => ({
    word: `word${i}`,
    start: i * 0.5,
    end: (i + 1) * 0.5,
    confidence: 0.9,
    speaker: i < 6 ? 'SPEAKER_00' : 'SPEAKER_01',
  }))
  return { words, language: 'en' }
}

function makeThreeD(): LookStyleProps {
  return {
    fontFamily: 'Archivo Black',
    fontWeight: 400,
    fontSize: 90,
    baseColor: '#FFFFFF',
    highlightColor: '#FFD60A',
    strokeColor: '#000000',
    strokeWidth: 1.5,
    shadowType: 'extrude',
    shadowColor: '#000000',
    shadowOffsetX: 10,
    shadowOffsetY: 10,
    shadowBlur: 0,
    letterSpacing: 0,
    wordSpacing: 0,
  } as LookStyleProps
}

function resetUndo() {
  useUndoStore.setState({ past: [], future: [], canUndo: false, canRedo: false })
}

describe('applyStyle', () => {
  beforeEach(() => {
    useSubtitleStore.setState({
      jobId: null,
      original: null,
      videoMetadata: null,
      session: null,
      speakerNames: {},
      speakerStyles: {},
      style: { ...DEFAULT_STYLE },
      activeAnimationPresetId: null,
      phraseAnimationPresetIds: {},
    })
    useSubtitleStore.getState().setJob('apply-job', buildTranscript(), MOCK_VIDEO_METADATA)
    useSubtitleStore.setState({ style: { ...DEFAULT_STYLE }, speakerStyles: {} })
    resetUndo()
  })

  it('applies the look globally in one undo step, keeping layout settings', () => {
    const THREE_D = makeThreeD()
    const before = useSubtitleStore.getState()
    const maxWords = before.maxWordsPerPhrase

    applyLookStyle({ level: 'global' }, THREE_D)

    const after = useSubtitleStore.getState()
    expect(pickLookProps(after.style)).toEqual(THREE_D)
    expect(after.style.verticalPosition).toBe(DEFAULT_STYLE.verticalPosition)
    expect(after.style.laneGap).toBe(DEFAULT_STYLE.laneGap)
    expect(after.style.lingerDuration).toBe(DEFAULT_STYLE.lingerDuration)
    expect(after.maxWordsPerPhrase).toBe(maxWords)
    expect(useUndoStore.getState().past.length).toBe(1)
  })

  it('applies to a speaker, keeping its verticalPosition override, in one undo step', () => {
    const THREE_D = makeThreeD()
    useSubtitleStore.getState().setSpeakerStyle('SPEAKER_00', { verticalPosition: 30 })
    resetUndo()

    applyLookStyle({ level: 'speaker', speakerId: 'SPEAKER_00' }, THREE_D)

    const override = useSubtitleStore.getState().speakerStyles.SPEAKER_00
    expect(override).toEqual({ ...THREE_D, verticalPosition: 30 })
    expect(useUndoStore.getState().past.length).toBe(1)
  })

  it('applies to a phrase, keeping its verticalPosition override, in one undo step', () => {
    const THREE_D = makeThreeD()
    useSubtitleStore.getState().setPhraseStyle(0, { verticalPosition: 20 })
    resetUndo()

    applyLookStyle({ level: 'phrase', phraseIndex: 0 }, THREE_D)

    const override = useSubtitleStore.getState().session!.phrases[0].styleOverride
    expect(override).toEqual({ ...THREE_D, verticalPosition: 20 })
    expect(useUndoStore.getState().past.length).toBe(1)
  })

  it('strips layout keys that arrive with the style (T-16-15)', () => {
    const THREE_D = makeThreeD()
    const prior = useSubtitleStore.getState().style.verticalPosition

    applyLookStyle({ level: 'global' }, { ...THREE_D, verticalPosition: 5 } as unknown as LookStyleProps)

    expect(useSubtitleStore.getState().style.verticalPosition).toBe(prior)
  })

  it('copies values: mutating the source afterwards does not change the project (D-10)', () => {
    const src = makeThreeD()

    applyLookStyle({ level: 'global' }, src)
    src.fontSize = 10
    src.baseColor = '#000000'

    const style = useSubtitleStore.getState().style
    expect(style.fontSize).toBe(90)
    expect(style.baseColor).toBe('#FFFFFF')
  })

  it('buildSaveAsStylePayload trims the name and keeps exactly the 14 look keys (D-11)', () => {
    const THREE_D = makeThreeD()
    applyLookStyle({ level: 'global' }, THREE_D)

    const payload = buildSaveAsStylePayload('  Mine  ', useSubtitleStore.getState().style)

    expect(payload.name).toBe('Mine')
    expect(Object.keys(payload.props).sort()).toEqual([...LOOK_STYLE_KEYS].sort())
    const props = payload.props as unknown as Record<string, unknown>
    expect(props.verticalPosition).toBeUndefined()
    expect(props.laneGap).toBeUndefined()
    expect(props.lingerDuration).toBeUndefined()

    const legacy = { ...useSubtitleStore.getState().style } as Partial<StyleProps>
    delete legacy.shadowType
    const legacyPayload = buildSaveAsStylePayload('Legacy', legacy as StyleProps)
    expect(legacyPayload.props.shadowType).toBe('drop')
  })
})
