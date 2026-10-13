import { describe, it, expect } from 'vitest'
import {
  buildTextShadow,
  buildStrokeShadow,
  buildExtrudeShadow,
  MAX_EXTRUDE_STEPS,
} from '../src/textShadow.ts'

// Verbatim copy of the pre-phase SubtitleOverlay expression (generateStrokeShadow + combinedShadow).
function legacyShadow(s: {
  strokeWidth: number
  strokeColor: string
  shadowOffsetX?: number
  shadowOffsetY?: number
  shadowBlur?: number
  shadowColor?: string
}): string {
  const gen = (width: number, color: string): string => {
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
  const strokeShadow = s.strokeWidth > 0 ? gen(s.strokeWidth * 2, s.strokeColor) : ''
  const dropShadow = `${s.shadowOffsetX ?? 0}px ${s.shadowOffsetY ?? 2}px ${s.shadowBlur ?? 4}px ${s.shadowColor ?? '#000000'}`
  return strokeShadow ? `${strokeShadow},${dropShadow}` : dropShadow
}

const base = {
  strokeWidth: 0,
  strokeColor: '#000000',
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  shadowBlur: 4,
  shadowColor: '#000000',
}

describe('buildTextShadow drop mode (D-06 legacy byte-identity)', () => {
  it('matches the pre-phase output for undefined and drop, with and without stroke', () => {
    for (const strokeWidth of [7.5, 0]) {
      const style = { ...base, strokeWidth }
      expect(buildTextShadow(style)).toBe(legacyShadow(style))
      expect(buildTextShadow({ ...style, shadowType: 'drop' })).toBe(legacyShadow(style))
    }
  })
})

describe('buildTextShadow extrude mode', () => {
  const ex = (x: number, y: number, extra: Record<string, unknown> = {}) =>
    buildTextShadow({ ...base, shadowType: 'extrude', shadowOffsetX: x, shadowOffsetY: y, ...extra })

  it('extrude (3,3) yields three 1px zero-blur steps', () => {
    expect(ex(3, 3)).toBe('1.00px 1.00px 0 #000000,2.00px 2.00px 0 #000000,3.00px 3.00px 0 #000000')
  })

  it('extrude (4,2) yields 4 entries scaled along the dominant axis', () => {
    const parts = ex(4, 2).split(',')
    expect(parts).toHaveLength(4)
    expect(parts[1]).toBe('2.00px 1.00px 0 #000000')
    expect(parts[3]).toBe('4.00px 2.00px 0 #000000')
  })

  it('extrude (0,0) is empty, or just the stroke ring with no trailing comma', () => {
    expect(ex(0, 0)).toBe('')
    expect(ex(0, 0, { strokeWidth: 1 })).toBe(buildStrokeShadow(2, '#000000'))
  })

  it('handles negative offsets', () => {
    const parts = ex(-3, 3).split(',')
    expect(parts[parts.length - 1]).toBe('-3.00px 3.00px 0 #000000')
  })

  it('D-07: stroke ring first in strokeColor, extrude steps in shadowColor', () => {
    const out = ex(2, 2, { strokeWidth: 1, strokeColor: '#111111', shadowColor: '#222222' })
    const stroke = buildStrokeShadow(2, '#111111')
    expect(out.startsWith(stroke + ',')).toBe(true)
    const extrude = out.slice(stroke.length + 1).split(',')
    expect(extrude.every((e) => e.endsWith('#222222'))).toBe(true)
    expect(stroke.includes('#222222')).toBe(false)
  })

  it('caps at MAX_EXTRUDE_STEPS entries', () => {
    const parts = ex(500, 500).split(',')
    expect(parts).toHaveLength(MAX_EXTRUDE_STEPS)
    expect(MAX_EXTRUDE_STEPS).toBe(100)
    expect(parts[parts.length - 1]).toBe('500.00px 500.00px 0 #000000')
  })

  it('ignores blur', () => {
    expect(ex(3, 3, { shadowBlur: 0 })).toBe(ex(3, 3, { shadowBlur: 25 }))
  })
})

describe('buildExtrudeShadow guards', () => {
  it('returns empty for non-finite offsets', () => {
    expect(buildExtrudeShadow(NaN, 3, '#000000')).toBe('')
    expect(buildExtrudeShadow(Infinity, 3, '#000000')).toBe('')
  })
})
