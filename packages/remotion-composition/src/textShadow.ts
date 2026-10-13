import type { ShadowType } from './types'

/** Hard cap on extrude layers so a huge stored offset can never emit an unbounded text-shadow list. */
export const MAX_EXTRUDE_STEPS = 100

/** Subset of style fields the text-shadow builders read. StyleProps and LookStyleProps both satisfy it. */
export interface TextShadowInput {
  strokeWidth: number
  strokeColor: string
  shadowType?: ShadowType
  shadowOffsetX?: number
  shadowOffsetY?: number
  shadowBlur?: number
  shadowColor?: string
}

/**
 * Generate text-shadow CSS for a stroke/outline effect.
 * Uses evenly-spaced shadow offsets around a circle - doesn't bleed into
 * letter counters (holes in o, e, a, etc.) unlike -webkit-text-stroke.
 */
export function buildStrokeShadow(width: number, color: string): string {
  if (width <= 0) return ''
  const STEPS = 16
  const shadows: string[] = []
  for (let i = 0; i < STEPS; i++) {
    const angle = (2 * Math.PI * i) / STEPS
    const x = (Math.cos(angle) * width).toFixed(1)
    const y = (Math.sin(angle) * width).toFixed(1)
    shadows.push(`${x}px ${y}px 0 ${color}`)
  }
  return shadows.join(',')
}

/**
 * Solid, zero-blur 3D block: stacked shadows stepping from the text out to (x, y),
 * at most 1px per step along the dominant axis. Capped at MAX_EXTRUDE_STEPS entries.
 */
export function buildExtrudeShadow(x: number, y: number, color: string): string {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return ''
  const n = Math.min(MAX_EXTRUDE_STEPS, Math.ceil(Math.max(Math.abs(x), Math.abs(y))))
  if (n <= 0) return ''
  const shadows: string[] = []
  for (let i = 1; i <= n; i++) {
    shadows.push(`${((x * i) / n).toFixed(2)}px ${((y * i) / n).toFixed(2)}px 0 ${color}`)
  }
  return shadows.join(',')
}

/**
 * Full text-shadow value: outline ring (strokeColor) first so it paints over the
 * extrusion, then either the legacy blurred drop shadow or the extrude block
 * (shadowColor, blur ignored).
 */
export function buildTextShadow(s: TextShadowInput): string {
  const stroke = s.strokeWidth > 0 ? buildStrokeShadow(s.strokeWidth * 2, s.strokeColor) : ''
  const second = s.shadowType === 'extrude'
    ? buildExtrudeShadow(s.shadowOffsetX ?? 0, s.shadowOffsetY ?? 0, s.shadowColor ?? '#000000')
    : `${s.shadowOffsetX ?? 0}px ${s.shadowOffsetY ?? 2}px ${s.shadowBlur ?? 4}px ${s.shadowColor ?? '#000000'}`
  if (stroke && second) return `${stroke},${second}`
  return stroke || second
}
