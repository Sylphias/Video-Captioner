import { describe, it, expect } from 'vitest'
import {
  LOOK_STYLE_KEYS,
  pickLookProps,
  shadowTypePatch,
  scaleLookStyle,
  EXTRUDE_SEED_OFFSET,
  EXTRUDE_SEED_THRESHOLD,
} from '../src/lookStyle.ts'

const classic = {
  fontFamily: 'Lilita One',
  fontWeight: 400,
  fontSize: 90,
  baseColor: '#FFFFFF',
  highlightColor: '#FFFF00',
  strokeColor: '#000000',
  strokeWidth: 7.5,
  shadowColor: '#000000',
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  shadowBlur: 4,
  letterSpacing: 0,
  wordSpacing: 0,
}

const D05 = [
  'fontFamily', 'fontWeight', 'fontSize', 'baseColor', 'highlightColor', 'strokeColor', 'strokeWidth',
  'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'shadowBlur', 'shadowType', 'letterSpacing', 'wordSpacing',
]

describe('LOOK_STYLE_KEYS (D-05)', () => {
  it('is exactly the 14 look keys and no layout keys', () => {
    expect(LOOK_STYLE_KEYS).toHaveLength(14)
    expect([...LOOK_STYLE_KEYS].sort()).toEqual([...D05].sort())
    for (const k of ['verticalPosition', 'laneGap', 'lingerDuration']) {
      expect((LOOK_STYLE_KEYS as readonly string[]).includes(k)).toBe(false)
    }
  })
})

describe('pickLookProps', () => {
  it('returns a fresh object with the 14 keys and shadowType drop when missing', () => {
    const input = { ...classic, verticalPosition: 80, laneGap: 8, lingerDuration: 0.4 }
    const out = pickLookProps(input)
    expect(out).not.toBe(input)
    expect(Object.keys(out).sort()).toEqual([...D05].sort())
    expect(out.shadowType).toBe('drop')
  })

  it('keeps extrude', () => {
    expect(pickLookProps({ ...classic, shadowType: 'extrude' }).shadowType).toBe('extrude')
  })
})

describe('shadowTypePatch', () => {
  it('seeds visible depth when switching to extrude with small offsets', () => {
    expect(EXTRUDE_SEED_OFFSET).toEqual({ x: 20, y: 40 })
    expect(EXTRUDE_SEED_THRESHOLD).toBe(3)
    expect(shadowTypePatch({ shadowOffsetX: 0, shadowOffsetY: 2 }, 'extrude')).toEqual({
      shadowType: 'extrude', shadowOffsetX: 20, shadowOffsetY: 40,
    })
    expect(shadowTypePatch({ shadowOffsetX: 2.9, shadowOffsetY: -2.9 }, 'extrude')).toEqual({
      shadowType: 'extrude', shadowOffsetX: 20, shadowOffsetY: 40,
    })
  })

  it('does not seed when offsets are already large, or when switching to drop', () => {
    expect(shadowTypePatch({ shadowOffsetX: 5, shadowOffsetY: 0 }, 'extrude')).toEqual({ shadowType: 'extrude' })
    expect(shadowTypePatch({ shadowOffsetX: 0, shadowOffsetY: 0 }, 'drop')).toEqual({ shadowType: 'drop' })
    expect(shadowTypePatch({ shadowOffsetX: 9, shadowOffsetY: 9 }, 'drop')).toEqual({ shadowType: 'drop' })
  })
})

describe('scaleLookStyle', () => {
  const props = pickLookProps(classic)

  it('scales dimensional fields by targetFontSize / fontSize', () => {
    const k = 22 / 90
    const out = scaleLookStyle({ ...props, shadowOffsetX: 3, letterSpacing: 2, wordSpacing: 4 }, 22)
    expect(out.fontSize).toBe(22)
    expect(out.strokeWidth).toBeCloseTo(7.5 * k)
    expect(out.shadowOffsetX).toBeCloseTo(3 * k)
    expect(out.shadowOffsetY).toBeCloseTo(2 * k)
    expect(out.shadowBlur).toBeCloseTo(4 * k)
    expect(out.letterSpacing).toBeCloseTo(2 * k)
    expect(out.wordSpacing).toBeCloseTo(4 * k)
    expect(out.baseColor).toBe(props.baseColor)
    expect(out.highlightColor).toBe(props.highlightColor)
    expect(out.strokeColor).toBe(props.strokeColor)
    expect(out.shadowColor).toBe(props.shadowColor)
    expect(out.fontFamily).toBe(props.fontFamily)
    expect(out.fontWeight).toBe(props.fontWeight)
    expect(out.shadowType).toBe(props.shadowType)
  })

  it('with fontSize 0 only replaces fontSize', () => {
    const out = scaleLookStyle({ ...props, fontSize: 0 }, 22)
    expect(out).toEqual({ ...props, fontSize: 22 })
  })
})
