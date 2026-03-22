import React from 'react'
import type { KeyframeTrack, KeyframeEasing } from '@eigen/shared-types'
import { useBuilderStore } from './useBuilderStore'

interface MotionPathOverlayProps {
  compositionWidth: number
  compositionHeight: number
}

// ─── Easing-aware interpolation ──────────────────────────────────────────────

function applyEasing(t: number, easing: KeyframeEasing): number {
  switch (easing.type) {
    case 'linear': return t
    case 'ease-in': return t * t
    case 'ease-out': return t * (2 - t)
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    case 'ease-in-cubic': return t * t * t
    case 'ease-out-cubic': { const u = 1 - t; return 1 - u * u * u }
    case 'ease-in-out-cubic': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    case 'bounce': {
      let v = t
      if (v < 1 / 2.75) return 7.5625 * v * v
      else if (v < 2 / 2.75) { v -= 1.5 / 2.75; return 7.5625 * v * v + 0.75 }
      else if (v < 2.5 / 2.75) { v -= 2.25 / 2.75; return 7.5625 * v * v + 0.9375 }
      else { v -= 2.625 / 2.75; return 7.5625 * v * v + 0.984375 }
    }
    case 'elastic': {
      if (t === 0 || t === 1) return t
      return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI)
    }
    case 'bezier': {
      // Simple cubic bezier approximation using de Casteljau
      const { p1x, p1y, p2x, p2y } = easing
      // Newton-Raphson to find parameter for given t on x-axis
      let u = t
      for (let i = 0; i < 8; i++) {
        const cx = 3 * p1x * u * (1 - u) * (1 - u) + 3 * p2x * u * u * (1 - u) + u * u * u
        const dx = 3 * p1x * (1 - u) * (1 - u) + 6 * (p2x - p1x) * u * (1 - u) + 3 * (1 - p2x) * u * u
        if (Math.abs(dx) < 1e-6) break
        u -= (cx - t) / dx
        u = Math.max(0, Math.min(1, u))
      }
      return 3 * p1y * u * (1 - u) * (1 - u) + 3 * p2y * u * u * (1 - u) + u * u * u
    }
    default: return t
  }
}

function interpolateAt(track: KeyframeTrack, time: number): number {
  const kfs = track.keyframes
  if (kfs.length === 0) return 50
  if (kfs.length === 1) return kfs[0].value
  if (time <= kfs[0].time) return kfs[0].value
  if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value

  let segIdx = 0
  for (let i = 0; i < kfs.length - 1; i++) {
    if (time <= kfs[i + 1].time) { segIdx = i; break }
  }

  const t0 = kfs[segIdx].time
  const t1 = kfs[segIdx + 1].time
  const v0 = kfs[segIdx].value
  const v1 = kfs[segIdx + 1].value
  const easing = track.easings[segIdx] ?? { type: 'linear' as const }
  const segProgress = t1 === t0 ? 1 : (time - t0) / (t1 - t0)
  const easedProgress = applyEasing(segProgress, easing)
  return v0 + (v1 - v0) * easedProgress
}

// ─── Phase color mapping ─────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, { stroke: string; fill: string }> = {
  enter: { stroke: 'rgba(76, 175, 114, 0.85)', fill: 'rgba(76, 175, 114, 0.9)' },
  active: { stroke: 'rgba(230, 180, 60, 0.85)', fill: 'rgba(230, 180, 60, 0.9)' },
  exit: { stroke: 'rgba(231, 111, 81, 0.85)', fill: 'rgba(231, 111, 81, 0.9)' },
}

/**
 * SVG overlay drawn on top of the Remotion Player canvas.
 * Shows easing-aware motion paths for position keyframes
 * in the currently selected phase's tracks.
 * Also shows scale and rotation indicators at keyframe positions.
 */
export function MotionPathOverlay({ compositionWidth, compositionHeight }: MotionPathOverlayProps) {
  const selectedPhase = useBuilderStore((s) => s.selectedPhase)
  const enterTracks = useBuilderStore((s) => s.enterTracks)
  const activeTracks = useBuilderStore((s) => s.activeTracks)
  const exitTracks = useBuilderStore((s) => s.exitTracks)

  const currentTracks = selectedPhase === 'enter' ? enterTracks
    : selectedPhase === 'active' ? activeTracks
    : exitTracks

  const xTrack = currentTracks.find((t) => t.property === 'x')
  const yTrack = currentTracks.find((t) => t.property === 'y')
  const scaleTrack = currentTracks.find((t) => t.property === 'scale')
  const rotTrack = currentTracks.find((t) => t.property === 'rotation')
  const opacityTrack = currentTracks.find((t) => t.property === 'opacity')

  const hasPositionTrack = (xTrack && xTrack.keyframes.length >= 1) || (yTrack && yTrack.keyframes.length >= 1)
  const hasAnyTrack = hasPositionTrack || scaleTrack || rotTrack || opacityTrack

  if (!hasAnyTrack) return null

  const colors = PHASE_COLORS[selectedPhase] ?? PHASE_COLORS.enter

  // Collect all keyframe times from position tracks for diamond markers
  const keyframeTimes = Array.from(
    new Set([
      ...(xTrack?.keyframes.map((kf) => kf.time) ?? []),
      ...(yTrack?.keyframes.map((kf) => kf.time) ?? []),
    ]),
  ).sort((a, b) => a - b)

  // Sample many points along the path for smooth easing-aware curves
  let pathData: string | null = null
  if (hasPositionTrack && keyframeTimes.length > 0) {
    const minTime = keyframeTimes[0]
    const maxTime = keyframeTimes[keyframeTimes.length - 1]
    const steps = Math.max(40, Math.ceil(maxTime - minTime) * 2)
    const sampledPoints: { x: number; y: number }[] = []

    for (let i = 0; i <= steps; i++) {
      const t = minTime + (maxTime - minTime) * (i / steps)
      const xVal = xTrack ? interpolateAt(xTrack, t) : 50
      const yVal = yTrack ? interpolateAt(yTrack, t) : 50
      sampledPoints.push({
        x: (xVal / 100) * compositionWidth,
        y: (yVal / 100) * compositionHeight,
      })
    }

    pathData = sampledPoints
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ')
  }

  // Diamond markers at keyframe positions
  const diamonds = keyframeTimes.map((time) => {
    const xVal = xTrack ? interpolateAt(xTrack, time) : 50
    const yVal = yTrack ? interpolateAt(yTrack, time) : 50
    return {
      time,
      cx: (xVal / 100) * compositionWidth,
      cy: (yVal / 100) * compositionHeight,
    }
  })

  // Scale indicators at keyframe positions
  const scaleMarkers = scaleTrack
    ? scaleTrack.keyframes.map((kf) => {
        const xVal = xTrack ? interpolateAt(xTrack, kf.time) : 50
        const yVal = yTrack ? interpolateAt(yTrack, kf.time) : 50
        return {
          cx: (xVal / 100) * compositionWidth,
          cy: (yVal / 100) * compositionHeight,
          scale: kf.value,
        }
      })
    : []

  // Rotation indicators at keyframe positions
  const rotMarkers = rotTrack
    ? rotTrack.keyframes.map((kf) => {
        const xVal = xTrack ? interpolateAt(xTrack, kf.time) : 50
        const yVal = yTrack ? interpolateAt(yTrack, kf.time) : 50
        return {
          cx: (xVal / 100) * compositionWidth,
          cy: (yVal / 100) * compositionHeight,
          rotation: kf.value,
        }
      })
    : []

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
      {/* Motion path line */}
      {pathData && (
        <path
          d={pathData}
          stroke={colors.stroke}
          strokeWidth={2}
          strokeDasharray="6 4"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* Diamond markers at keyframe positions */}
      {diamonds.map((d, i) => {
        const size = 5
        return (
          <polygon
            key={`d-${i}`}
            points={`${d.cx},${d.cy - size} ${d.cx + size},${d.cy} ${d.cx},${d.cy + size} ${d.cx - size},${d.cy}`}
            fill={colors.fill}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={1}
          />
        )
      })}

      {/* Scale rings — circle radius proportional to scale value */}
      {scaleMarkers.map((m, i) => (
        <circle
          key={`s-${i}`}
          cx={m.cx}
          cy={m.cy}
          r={Math.max(4, m.scale * 12)}
          fill="none"
          stroke="rgba(180, 140, 255, 0.6)"
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
      ))}

      {/* Rotation ticks — short line showing angle */}
      {rotMarkers.map((m, i) => {
        const rad = (m.rotation * Math.PI) / 180
        const len = 14
        const x2 = m.cx + Math.cos(rad - Math.PI / 2) * len
        const y2 = m.cy + Math.sin(rad - Math.PI / 2) * len
        return (
          <line
            key={`r-${i}`}
            x1={m.cx}
            y1={m.cy}
            x2={x2}
            y2={y2}
            stroke="rgba(255, 160, 80, 0.7)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}
