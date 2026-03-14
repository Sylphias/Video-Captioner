import { useRef, useState, useCallback } from 'react'
import './BezierEditor.css'

interface BezierEditorProps {
  p1x: number  // 0-1
  p1y: number  // unconstrained (overshoot allowed)
  p2x: number  // 0-1
  p2y: number  // unconstrained
  onChange: (p1x: number, p1y: number, p2x: number, p2y: number) => void
  size?: number  // width/height in px, default 160
}

type DraggingHandle = 'p1' | 'p2' | null

// SVG coordinate helpers
// SVG space: x 0-100, y 0-100 (y flipped: 100=bottom=bezier 0, 0=top=bezier 1)
function toSvgX(bx: number): number { return bx * 100 }
function toSvgY(by: number): number { return (1 - by) * 100 }

// Convert SVG-space coords (within 0-100 box) back to bezier space
function fromSvgX(sx: number): number { return sx / 100 }
function fromSvgY(sy: number): number { return 1 - sy / 100 }

export function BezierEditor({
  p1x, p1y, p2x, p2y,
  onChange,
  size = 160,
}: BezierEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<DraggingHandle>(null)

  // SVG positions for control points
  const p1SvgX = toSvgX(p1x)
  const p1SvgY = toSvgY(p1y)
  const p2SvgX = toSvgX(p2x)
  const p2SvgY = toSvgY(p2y)

  // The cubic bezier curve path (fixed start/end: (0,100) to (100,0) in SVG space)
  const curvePath = `M 0,100 C ${p1SvgX},${p1SvgY} ${p2SvgX},${p2SvgY} 100,0`

  // Convert pointer event to SVG coordinate space (relative to the 0-120 viewBox)
  function pointerToSvgCoords(e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()

    // viewBox is "-10 -30 120 160" so the visible SVG range is 120w x 160h
    // but the coordinate space maps from -10 to 110 in x and -30 to 130 in y
    const viewBoxMinX = -10
    const viewBoxMinY = -30
    const viewBoxW = 120
    const viewBoxH = 160

    const svgX = viewBoxMinX + ((e.clientX - rect.left) / rect.width) * viewBoxW
    const svgY = viewBoxMinY + ((e.clientY - rect.top) / rect.height) * viewBoxH

    return { x: svgX, y: svgY }
  }

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return

    const { x: svgX, y: svgY } = pointerToSvgCoords(e)

    // Convert SVG coords to bezier space
    let bx = fromSvgX(svgX)
    const by = fromSvgY(svgY)

    // Clamp x to [0, 1], leave y unclamped (allow overshoot)
    bx = Math.max(0, Math.min(1, bx))

    if (dragging === 'p1') {
      onChange(bx, by, p2x, p2y)
    } else {
      onChange(p1x, p1y, bx, by)
    }
  }, [dragging, p1x, p1y, p2x, p2y, onChange])

  const handlePointerUp = useCallback(() => {
    setDragging(null)
  }, [])

  function handleHandlePointerDown(which: DraggingHandle, e: React.PointerEvent<SVGCircleElement>) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(which)
  }

  return (
    <div className="bezier-editor" style={{ width: size, height: size }}>
      <svg
        ref={svgRef}
        className="bezier-editor__svg"
        viewBox="-10 -30 120 160"
        width={size}
        height={size}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Reference line: linear diagonal from (0,100) to (100,0) */}
        <line
          className="bezier-editor__reference"
          x1={0} y1={100} x2={100} y2={0}
        />

        {/* Control handle lines (dashed) */}
        <line
          className="bezier-editor__handle-line"
          x1={0} y1={100} x2={p1SvgX} y2={p1SvgY}
        />
        <line
          className="bezier-editor__handle-line"
          x1={100} y1={0} x2={p2SvgX} y2={p2SvgY}
        />

        {/* The cubic bezier curve */}
        <path
          className="bezier-editor__curve"
          d={curvePath}
        />

        {/* Control handle circles — draggable */}
        <circle
          className="bezier-editor__handle"
          cx={p1SvgX}
          cy={p1SvgY}
          r={6}
          onPointerDown={(e) => handleHandlePointerDown('p1', e)}
        />
        <circle
          className="bezier-editor__handle"
          cx={p2SvgX}
          cy={p2SvgY}
          r={6}
          onPointerDown={(e) => handleHandlePointerDown('p2', e)}
        />
      </svg>
    </div>
  )
}
