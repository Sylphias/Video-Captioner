import './fonts' // ensure module-level font loading side effects fire

export { SubtitleComposition } from './SubtitleComposition'
export { SubtitleOverlay, findActiveWordIndex } from './SubtitleOverlay'
export { computeKeyframeStyles, computePhaseKeyframeStyles, computeAnimationStyles, computeWordAnimationStyles, mergeStyles } from './animations'
export type { StyleProps, ShadowType, SubtitleCompositionProps, SpeakerStyleOverride, CompositionPhrase } from './types'
export type { FontName } from './fonts'
export { FONT_NAMES, getFontFamily, FONT_WEIGHT_OPTIONS } from './fonts'
export { buildStrokeShadow, buildExtrudeShadow, buildTextShadow, MAX_EXTRUDE_STEPS } from './textShadow'
export type { TextShadowInput } from './textShadow'
export { LOOK_STYLE_KEYS, pickLookProps, shadowTypePatch, scaleLookStyle, EXTRUDE_SEED_OFFSET, EXTRUDE_SEED_THRESHOLD } from './lookStyle'
export type { LookStyleKey, LookStyleProps } from './lookStyle'
export const COMPOSITION_ID = 'SubtitleComposition'
