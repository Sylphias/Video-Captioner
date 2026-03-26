import { useEffect, useRef } from 'react'

interface WaveformCanvasProps {
  samples: number[]
  duration: number
  pixelsPerSecond: number
  height: number
}

/**
 * Canvas-based waveform visualization component.
 *
 * Renders audio amplitude as a center-mirrored vertical line chart.
 * Canvas width = duration * pixelsPerSecond (may be wider than viewport — parent scrolls).
 * Uses --color-accent-green at 30% opacity for the waveform color.
 */
export function WaveformCanvas({ samples, duration, pixelsPerSecond, height }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)

  const canvasWidth = Math.ceil(duration * pixelsPerSecond)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || samples.length === 0) return

    // Cancel any pending animation frame
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }

    animFrameRef.current = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Clear previous drawing
      ctx.clearRect(0, 0, canvasWidth, height)

      // Draw waveform: each sample gets a proportional horizontal slice
      // Vertical lines drawn from center outward (mirrored above/below)
      const centerY = height / 2
      const sampleCount = samples.length
      const sampleWidth = canvasWidth / sampleCount

      ctx.strokeStyle = 'rgba(0, 230, 150, 0.3)' // --color-accent-green at 30% opacity
      ctx.lineWidth = Math.max(1, sampleWidth)

      for (let i = 0; i < sampleCount; i++) {
        const amplitude = samples[i]
        const x = (i + 0.5) * sampleWidth
        const halfHeight = amplitude * centerY * 0.9 // 90% of half height max

        ctx.beginPath()
        ctx.moveTo(x, centerY - halfHeight)
        ctx.lineTo(x, centerY + halfHeight)
        ctx.stroke()
      }
    })

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [samples, duration, pixelsPerSecond, height, canvasWidth])

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={height}
      style={{ display: 'block', width: canvasWidth, height }}
    />
  )
}
