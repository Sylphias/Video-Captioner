import React from 'react'
import type { KeyframeTrack } from '@eigen/shared-types'
import { useBuilderStore } from './useBuilderStore'

interface MotionPathOverlayProps {
  compositionWidth: number
  compositionHeight: number
}

/**
 * SVG overlay drawn on top of the Remotion Player canvas.
 * - Draws a dotted line connecting consecutive position keyframe positions.
 * - Shows small diamond markers at each keyframe.
 * - Only rendered when showMotionPath is true in the builder store.
 * - pointer-events: none — clicks pass through to the drag overlay beneath.
 */
export function MotionPathOverlay({ compositionWidth, compositionHeight }: MotionPathOverlayProps) {
  const keyframeTracks = useBuilderStore((s) => s.keyframeTracks)

  const xTrack = keyframeTracks.find((t) => t.property === 'x')
  const yTrack = keyframeTracks.find((t) => t.property === 'y')

  if (!xTrack || !yTrack || xTrack.keyframes.length < 1) {
    return null
  }

  // Build sorted position points by pairing x and y keyframes at matching times.
  // We use the x keyframe times as the reference timeline and interpolate y if needed.
  // For simplicity: collect all unique times from both tracks and look up values.
  const allTimes = Array.from(
    new Set([
      ...xTrack.keyframes.map((kf) => kf.time),
      ...yTrack.keyframes.map((kf) => kf.time),
    ]),
  ).sort((a, b) => a - b)

  function lookupValue(track: KeyframeTrack, time: number): number {
    const { keyframes } = track
    if (keyframes.length === 0) return 50
    if (keyframes.length === 1) return keyframes[0].value

    // Find the segment
    const segIdx = keyframes.findIndex((kf) => kf.time > time)
    if (segIdx === -1) return keyframes[keyframes.length - 1].value
    if (segIdx === 0) return keyframes[0].value

    // Linear interpolation for the overlay (visual only — not exact easing)
    const from = keyframes[segIdx - 1]
    const to = keyframes[segIdx]
    const t = (time - from.time) / (to.time - from.time)
    return from.value + t * (to.value - from.value)
  }

  // Convert % values to SVG coordinates within the viewBox
  const points = allTimes.map((time) => ({
    time,
    svgX: lookupValue(xTrack, time),   // xPct → maps directly to viewBox % of width
    svgY: lookupValue(yTrack, time),   // yPct → maps directly to viewBox % of height
  }))

  // Build SVG path: dotted line between consecutive points
  const pathData =
    points.length > 1
      ? points
          .map((p, i) =>
            i === 0
              ? `M ${(p.svgX / 100) * compositionWidth} ${(p.svgY / 100) * compositionHeight}`
              : `L ${(p.svgX / 100) * compositionWidth} ${(p.svgY / 100) * compositionHeight}`,
          )
          .join(' ')
      : null

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'visible',
      }}
      viewBox={`0 0 ${compositionWidth} ${compositionHeight}`}
      preserveAspectRatio="none"
    >
      {/* Dotted motion path line */}
      {pathData && (
        <path
          d={pathData}
          stroke="rgba(76, 175, 114, 0.85)"
          strokeWidth={2}
          strokeDasharray="6 4"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* Diamond markers at each keyframe position */}
      {points.map((p, i) => {
        const cx = (p.svgX / 100) * compositionWidth
        const cy = (p.svgY / 100) * compositionHeight
        const size = 5
        // Diamond: rotated square as a polygon
        return (
          <polygon
            key={i}
            points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`}
            fill="rgba(76, 175, 114, 0.9)"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={1}
          />
        )
      })}
    </svg>
  )
}
