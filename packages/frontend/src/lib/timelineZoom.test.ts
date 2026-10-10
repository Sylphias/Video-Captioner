import { describe, it, expect } from 'vitest'
import {
  clampViewStart,
  offscreenSide,
  centeredViewStart,
  zoomAnchoredViewStart,
} from './timelineZoom.ts'

describe('clampViewStart', () => {
  it('clamps below 0 to 0', () => {
    expect(clampViewStart(-5, 10, 100)).toBe(0)
  })
  it('clamps past the end so the window ends at totalDuration', () => {
    expect(clampViewStart(95, 10, 100)).toBe(90)
  })
  it('returns 0 when the window is longer than the timeline', () => {
    expect(clampViewStart(20, 150, 100)).toBe(0)
  })
  it('leaves in-range values untouched', () => {
    expect(clampViewStart(42, 10, 100)).toBe(42)
  })
})

describe('offscreenSide', () => {
  it('reports left/right/null', () => {
    expect(offscreenSide(5, 10, 10)).toBe('left')
    expect(offscreenSide(25, 10, 10)).toBe('right')
    expect(offscreenSide(15, 10, 10)).toBeNull()
  })
  it('treats the window edges as visible', () => {
    expect(offscreenSide(10, 10, 10)).toBeNull()
    expect(offscreenSide(20, 10, 10)).toBeNull()
  })
})

describe('centeredViewStart', () => {
  it('centers the time', () => {
    expect(centeredViewStart(50, 10, 100)).toBe(45)
  })
  it('clamps at both ends', () => {
    expect(centeredViewStart(1, 10, 100)).toBe(0)
    expect(centeredViewStart(99, 10, 100)).toBe(90)
  })
})

describe('zoomAnchoredViewStart', () => {
  const total = 100

  it('keeps a visible playhead at the same fractional screen position (zoom in)', () => {
    // Window [40, 60], playhead at 45 → 25% across.
    const vs = zoomAnchoredViewStart({
      viewStart: 40, visibleDuration: 20, newVisibleDuration: 10, totalDuration: total, playheadTime: 45,
    })
    expect(vs).toBeCloseTo(42.5)
    expect((45 - vs) / 10).toBeCloseTo(0.25)
  })

  it('keeps a visible playhead at the same fractional screen position (zoom out)', () => {
    const vs = zoomAnchoredViewStart({
      viewStart: 40, visibleDuration: 10, newVisibleDuration: 20, totalDuration: total, playheadTime: 47.5,
    })
    expect((47.5 - vs) / 20).toBeCloseTo(0.75)
  })

  it('centers on the playhead when it is off-screen to the right', () => {
    const vs = zoomAnchoredViewStart({
      viewStart: 0, visibleDuration: 20, newVisibleDuration: 10, totalDuration: total, playheadTime: 70,
    })
    expect(vs).toBeCloseTo(65)
  })

  it('centers on the playhead when it is off-screen to the left', () => {
    const vs = zoomAnchoredViewStart({
      viewStart: 60, visibleDuration: 20, newVisibleDuration: 10, totalDuration: total, playheadTime: 30,
    })
    expect(vs).toBeCloseTo(25)
  })

  it('clamps at 0', () => {
    // Playhead at 2s, 50% across a [−8..12]-ish request → would go negative.
    const vs = zoomAnchoredViewStart({
      viewStart: 0, visibleDuration: 4, newVisibleDuration: 40, totalDuration: total, playheadTime: 2,
    })
    expect(vs).toBe(0)
  })

  it('clamps at the end', () => {
    const vs = zoomAnchoredViewStart({
      viewStart: 96, visibleDuration: 4, newVisibleDuration: 40, totalDuration: total, playheadTime: 98,
    })
    expect(vs).toBe(60)
  })

  it('composes over repeated zoom steps without drifting the playhead', () => {
    const playhead = 33.3
    let viewStart = 20
    let visible = 40
    const fraction0 = (playhead - viewStart) / visible
    for (const factor of [0.85, 0.85, 1.18, 0.85, 0.85, 0.85, 1.18, 1.18]) {
      const next = visible * factor
      viewStart = zoomAnchoredViewStart({
        viewStart, visibleDuration: visible, newVisibleDuration: next, totalDuration: total, playheadTime: playhead,
      })
      visible = next
      expect((playhead - viewStart) / visible).toBeCloseTo(fraction0, 9)
    }
  })

  it('falls back to centering for a degenerate (zero-length) current window', () => {
    const vs = zoomAnchoredViewStart({
      viewStart: 10, visibleDuration: 0, newVisibleDuration: 10, totalDuration: total, playheadTime: 50,
    })
    expect(vs).toBe(45)
  })
})
