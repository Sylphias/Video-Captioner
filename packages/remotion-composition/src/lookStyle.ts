import type { StyleProps, ShadowType } from './types'

/**
 * D-05 look-style contract: the fields a library style stores and applies.
 * Layout keys (verticalPosition, laneGap, lingerDuration) are deliberately absent.
 */
export const LOOK_STYLE_KEYS = [
  'fontFamily',
  'fontWeight',
  'fontSize',
  'baseColor',
  'highlightColor',
  'strokeColor',
  'strokeWidth',
  'shadowColor',
  'shadowOffsetX',
  'shadowOffsetY',
  'shadowBlur',
  'shadowType',
  'letterSpacing',
  'wordSpacing',
] as const

export type LookStyleKey = typeof LOOK_STYLE_KEYS[number]
export type LookStyleProps = Required<Pick<StyleProps, LookStyleKey>>

/** Copy exactly the look keys into a new object; a missing shadowType becomes 'drop'. */
export function pickLookProps(
  s: Omit<LookStyleProps, 'shadowType'> & { shadowType?: ShadowType },
): LookStyleProps {
  const out: Record<string, unknown> = {}
  for (const key of LOOK_STYLE_KEYS) out[key] = s[key]
  out.shadowType = s.shadowType === 'extrude' ? 'extrude' : 'drop'
  return out as unknown as LookStyleProps
}

/** Depth seeded into X/Y when switching to Extrude with a near-zero offset (user-requested 20/40). */
export const EXTRUDE_SEED_OFFSET = { x: 20, y: 40 } as const
/** Offsets below this (both axes) count as "no visible depth". */
export const EXTRUDE_SEED_THRESHOLD = 3

/**
 * Patch for changing shadow type. Switching to extrude while both offsets are tiny
 * seeds a visible depth so Extrude never looks broken.
 */
export function shadowTypePatch(
  current: Pick<LookStyleProps, 'shadowOffsetX' | 'shadowOffsetY'>,
  next: ShadowType,
): Partial<LookStyleProps> {
  if (
    next === 'extrude' &&
    Math.abs(current.shadowOffsetX) < EXTRUDE_SEED_THRESHOLD &&
    Math.abs(current.shadowOffsetY) < EXTRUDE_SEED_THRESHOLD
  ) {
    return { shadowType: 'extrude', shadowOffsetX: EXTRUDE_SEED_OFFSET.x, shadowOffsetY: EXTRUDE_SEED_OFFSET.y }
  }
  return { shadowType: next }
}

/** Scale size-dependent fields so a style renders proportionally at another font size (thumbnails). */
export function scaleLookStyle(props: LookStyleProps, targetFontSize: number): LookStyleProps {
  const k = props.fontSize <= 0 ? 1 : targetFontSize / props.fontSize
  return {
    ...props,
    fontSize: targetFontSize,
    strokeWidth: props.strokeWidth * k,
    shadowOffsetX: props.shadowOffsetX * k,
    shadowOffsetY: props.shadowOffsetY * k,
    shadowBlur: props.shadowBlur * k,
    letterSpacing: props.letterSpacing * k,
    wordSpacing: props.wordSpacing * k,
  }
}
