import './fonts' // ensure module-level font loading side effects fire

export { SubtitleComposition } from './SubtitleComposition'
export { SubtitleOverlay, findActiveWordIndex } from './SubtitleOverlay'
export type { StyleProps, SubtitleCompositionProps, SpeakerStyleOverride, AnimationType } from './types'
export type { FontName } from './fonts'
export { FONT_NAMES, getFontFamily, FONT_WEIGHT_OPTIONS } from './fonts'
export const COMPOSITION_ID = 'SubtitleComposition'
