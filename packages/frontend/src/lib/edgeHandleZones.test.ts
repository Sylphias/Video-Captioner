import { describe, it, expect } from 'vitest'
import { computeEdgeHandleZones } from './edgeHandleZones.ts'
import type { EdgeHandleZones } from './edgeHandleZones.ts'

/** Which handle a pointer x hits; later zones win, matching DOM paint order (start then end per phrase). */
function hit(zones: EdgeHandleZones[], x: number): string | null {
  let result: string | null = null
  zones.forEach((z, i) => {
    if (x >= z.start.left && x < z.start.right) result = `${i}:start`
    if (x >= z.end.left && x < z.end.right) result = `${i}:end`
  })
  return result
}

const width = (z: { left: number; right: number }) => z.right - z.left

describe('computeEdgeHandleZones', () => {
  it('gives an isolated wide block ~12px zones straddling each edge', () => {
    const [z] = computeEdgeHandleZones([{ start: 100, end: 200 }])
    expect(z.start).toEqual({ left: 94, right: 106 })
    expect(z.end).toEqual({ left: 194, right: 206 })
  })

  it('keeps the body of a narrow block grabbable and start distinct from end', () => {
    const [z] = computeEdgeHandleZones([{ start: 100, end: 112 }])
    // inner capped at 25% of 12px = 3px
    expect(z.start.right).toBe(103)
    expect(z.end.left).toBe(109)
    expect(z.start.right).toBeLessThan(z.end.left)
    // middle of the block hits no handle
    expect(hit([z], 106)).toBeNull()
    // both edges still have a full outside hit area
    expect(hit([z], 95)).toBe('0:start')
    expect(hit([z], 116)).toBe('0:end')
  })

  it('handles a zero-width block with handles entirely outside the edges', () => {
    const [z] = computeEdgeHandleZones([{ start: 50, end: 50 }])
    expect(z.start).toEqual({ left: 44, right: 50 })
    expect(z.end).toEqual({ left: 50, right: 56 })
  })

  it('resolves touching blocks by which side of the seam the pointer is on', () => {
    const zones = computeEdgeHandleZones([
      { start: 0, end: 100 },
      { start: 100, end: 200 },
    ])
    expect(zones[0].end.right).toBe(100)
    expect(zones[1].start.left).toBe(100)
    expect(hit(zones, 99)).toBe('0:end')
    expect(hit(zones, 95)).toBe('0:end')
    expect(hit(zones, 100)).toBe('1:start')
    expect(hit(zones, 104)).toBe('1:start')
  })

  it('splits a small gap at its midpoint', () => {
    const zones = computeEdgeHandleZones([
      { start: 0, end: 100 },
      { start: 104, end: 200 },
    ])
    expect(zones[0].end.right).toBe(102)
    expect(zones[1].start.left).toBe(102)
    expect(hit(zones, 101)).toBe('0:end')
    expect(hit(zones, 103)).toBe('1:start')
  })

  it('leaves zones untouched when the gap is wide enough', () => {
    const zones = computeEdgeHandleZones([
      { start: 0, end: 100 },
      { start: 140, end: 200 },
    ])
    expect(zones[0].end).toEqual({ left: 94, right: 106 })
    expect(zones[1].start).toEqual({ left: 134, right: 146 })
  })

  it('keeps a minimum grabbable width for both handles when blocks overlap', () => {
    const zones = computeEdgeHandleZones([
      { start: 0, end: 120 },
      { start: 100, end: 200 },
    ])
    expect(width(zones[0].end)).toBeGreaterThanOrEqual(4)
    expect(width(zones[1].start)).toBeGreaterThanOrEqual(4)
    expect(zones[0].end.right).toBe(zones[1].start.left) // no overlap between them
  })

  it('resolves neighbours by visual order regardless of input order', () => {
    const zones = computeEdgeHandleZones([
      { start: 100, end: 200 },
      { start: 0, end: 100 },
    ])
    expect(zones[1].end.right).toBe(100)
    expect(zones[0].start.left).toBe(100)
    expect(hit(zones, 99)).toBe('1:end')
    expect(hit(zones, 101)).toBe('0:start')
  })

  it('makes both edges of two tiny adjacent blocks independently grabbable', () => {
    const zones = computeEdgeHandleZones([
      { start: 100, end: 104 },
      { start: 104, end: 108 },
    ])
    expect(hit(zones, 96)).toBe('0:start')
    expect(hit(zones, 103)).toBe('0:end')
    expect(hit(zones, 105)).toBe('1:start')
    expect(hit(zones, 110)).toBe('1:end')
  })
})
