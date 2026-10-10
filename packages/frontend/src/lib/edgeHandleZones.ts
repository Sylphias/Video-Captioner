/**
 * Hit-zone layout for phrase edge-drag (resize) handles on a single timeline
 * lane. Pure pixel math shared by TimingEditor and MiniTimeline.
 *
 * Each phrase edge gets a hit zone straddling the edge: `inner` px into the
 * block and `outer` px outside it (~12px total), so a thin visible edge is
 * still easy to grab. Rules:
 *
 * - The inner part is capped at `innerFraction` of the block width, so on a
 *   narrow block the two handles never swallow the whole body (the middle of
 *   the block stays grabbable for move/click) and start stays distinct from end.
 * - Where the end zone of one block collides with the start zone of the next
 *   block (touching, small gap, or overlap), both are cut at the seam — the
 *   midpoint between the previous block's end and the next block's start.
 *   Pointer left of the seam → previous phrase's END handle; right of the
 *   seam → next phrase's START handle.
 * - Each zone keeps at least `minWidth` px so it can always be grabbed.
 *
 * Handles are expected to be rendered above all phrase blocks of the lane so
 * a neighbouring block body (or linger tail) can never swallow them.
 */

export interface EdgeSpan {
  /** Pixel x of the phrase start edge. */
  start: number
  /** Pixel x of the phrase end edge (>= start). */
  end: number
}

export interface HandleZone {
  left: number
  right: number
}

export interface EdgeHandleZones {
  start: HandleZone
  end: HandleZone
}

export interface EdgeHandleOptions {
  /** Max hit width inside the block, px. */
  inner?: number
  /** Hit width outside the block, px. */
  outer?: number
  /** Max fraction of the block width a single handle may take inside the block. */
  innerFraction?: number
  /** Minimum hit width of any zone after seam resolution, px. */
  minWidth?: number
}

export const EDGE_HANDLE_DEFAULTS: Required<EdgeHandleOptions> = {
  inner: 6,
  outer: 6,
  innerFraction: 0.25,
  minWidth: 4,
}

/** Compute handle hit zones for every span of one lane (result is index-aligned with `spans`). */
export function computeEdgeHandleZones(spans: EdgeSpan[], options: EdgeHandleOptions = {}): EdgeHandleZones[] {
  const o = { ...EDGE_HANDLE_DEFAULTS, ...options }

  const zones: EdgeHandleZones[] = spans.map((s) => {
    const width = Math.max(0, s.end - s.start)
    const inner = Math.min(o.inner, width * o.innerFraction)
    return {
      start: { left: s.start - o.outer, right: s.start + inner },
      end: { left: s.end - inner, right: s.end + o.outer },
    }
  })

  // Resolve collisions between neighbouring blocks in visual (start) order.
  const order = spans.map((_, i) => i).sort((a, b) => spans[a].start - spans[b].start || a - b)
  for (let k = 0; k + 1 < order.length; k++) {
    const prev = order[k]
    const next = order[k + 1]
    const prevEnd = zones[prev].end
    const nextStart = zones[next].start
    if (prevEnd.right <= nextStart.left) continue // no collision

    const seam = (spans[prev].end + spans[next].start) / 2
    prevEnd.right = seam
    nextStart.left = seam
    if (prevEnd.right - prevEnd.left < o.minWidth) prevEnd.left = prevEnd.right - o.minWidth
    if (nextStart.right - nextStart.left < o.minWidth) nextStart.right = nextStart.left + o.minWidth
  }

  return zones
}
