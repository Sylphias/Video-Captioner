import React from 'react'
import type { KeyframeTrack } from '@eigen/shared-types'
import { useBuilderStore } from './useBuilderStore'

interface MotionPathOverlayProps {
  compositionWidth: number
  compositionHeight: number
}

/**
 * SVG overlay drawn on top of the Remotion Player canvas.
 * Shows a dotted line connecting consecutive position keyframe positions
 * for the currently selected phase's tracks.
 */
export function MotionPathOverlay({ compositionWidth, compositionHeight }: MotionPathOverlayProps) {
  const selectedPhase = useBuilderStore((s) => s.selectedPhase)
  const enterTracks = useBuilderStore((s) => s.enterTracks)
  const activeTracks = useBuilderStore((s) => s.activeTracks)
  const exitTracks = useBuilderStore((s) => s.exitTracks)

  // Use the current phase's tracks
  const currentTracks = selectedPhase === 'enter' ? enterTracks
    : selectedPhase === 'active' ? activeTracks
    : exitTracks

  const xTrack = currentTracks.find((t) => t.property === 'x')
  const yTrack = currentTracks.find((t) => t.property === 'y')

  if (!xTrack || !yTrack || xTrack.keyframes.length < 1) {
    return null
  }

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

    const segIdx = keyframes.findIndex((kf) => kf.time > time)
    if (segIdx === -1) return keyframes[keyframes.length - 1].value
    if (segIdx === 0) return keyframes[0].value

    const from = keyframes[segIdx - 1]
    const to = keyframes[segIdx]
    const t = (time - from.time) / (to.time - from.time)
    return from.value + t * (to.value - from.value)
  }

  const points = allTimes.map((time) => ({
    time,
    svgX: lookupValue(xTrack, time),
    svgY: lookupValue(yTrack, time),
  }))

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

      {points.map((p, i) => {
        const cx = (p.svgX / 100) * compositionWidth
        const cy = (p.svgY / 100) * compositionHeight
        const size = 5
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
