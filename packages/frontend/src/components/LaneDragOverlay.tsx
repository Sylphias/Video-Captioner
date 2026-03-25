import { useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import type { SpeakerLane } from '@eigen/shared-types'
import type { SessionPhrase } from '../store/subtitleStore.ts'
import { useSubtitleStore } from '../store/subtitleStore.ts'
import { useUndoStore } from '../store/undoMiddleware.ts'
import { getSpeakerColor } from '../utils/speakerColors.ts'
import './LaneDragOverlay.css'

interface LaneDragOverlayProps {
  speakerLanes: Record<string, SpeakerLane>
  speakerNames: Record<string, string>
  containerRef: RefObject<HTMLDivElement | null>
  currentFrame: number
  phrases: SessionPhrase[]
  fps: number
}

export function LaneDragOverlay({
  speakerLanes,
  speakerNames,
  containerRef,
  currentFrame,
  phrases,
  fps,
}: LaneDragOverlayProps) {
  const setSpeakerLane = useSubtitleStore((s) => s.setSpeakerLane)
  const setPhraseStyle = useSubtitleStore((s) => s.setPhraseStyle)

  // Ref used by drag handlers to avoid stale closure issues
  const draggingRef = useRef<{
    type: 'speaker' | 'phrase'
    id: string | number    // speakerId (string) or phraseIndex (number)
    startY: number
    startPosition: number
  } | null>(null)

  const getContainerHeight = useCallback((): number => {
    return containerRef.current?.offsetHeight ?? 1
  }, [containerRef])

  const handleSpeakerMouseDown = useCallback((
    e: React.MouseEvent,
    speakerId: string,
    currentPosition: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()

    // Push undo snapshot before drag
    const storeState = useSubtitleStore.getState()
    const { session, style, speakerNames: sn, speakerStyles, maxWordsPerPhrase, speakerLanes: sl, overlapGap, maxVisibleRows } = storeState
    useUndoStore.getState().pushSnapshot({
      session: session ? {
        words: structuredClone(session.words),
        phrases: structuredClone(session.phrases),
        manualSplitWordIndices: Array.from(session.manualSplitWordIndices),
      } : null,
      style: structuredClone(style) as unknown as Record<string, unknown>,
      maxWordsPerPhrase,
      speakerNames: { ...sn },
      speakerStyles: structuredClone(speakerStyles) as unknown as Record<string, Record<string, unknown>>,
      speakerLanes: structuredClone(sl),
      overlapGap,
      maxVisibleRows,
    })

    draggingRef.current = {
      type: 'speaker',
      id: speakerId,
      startY: e.clientY,
      startPosition: currentPosition,
    }

    const onMove = (moveE: MouseEvent) => {
      const drag = draggingRef.current
      if (!drag || drag.type !== 'speaker') return
      const containerH = getContainerHeight()
      const deltaPercent = ((moveE.clientY - drag.startY) / containerH) * 100
      const newPos = Math.min(95, Math.max(5, drag.startPosition + deltaPercent))
      useSubtitleStore.getState().setSpeakerLane(drag.id as string, newPos)
    }

    const onUp = () => {
      draggingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [getContainerHeight, setSpeakerLane])

  const handlePhraseMouseDown = useCallback((
    e: React.MouseEvent,
    phraseIndex: number,
    currentPosition: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()

    // Push undo snapshot before drag
    const storeState = useSubtitleStore.getState()
    const { session, style, speakerNames: sn, speakerStyles, maxWordsPerPhrase, speakerLanes: sl, overlapGap, maxVisibleRows } = storeState
    useUndoStore.getState().pushSnapshot({
      session: session ? {
        words: structuredClone(session.words),
        phrases: structuredClone(session.phrases),
        manualSplitWordIndices: Array.from(session.manualSplitWordIndices),
      } : null,
      style: structuredClone(style) as unknown as Record<string, unknown>,
      maxWordsPerPhrase,
      speakerNames: { ...sn },
      speakerStyles: structuredClone(speakerStyles) as unknown as Record<string, Record<string, unknown>>,
      speakerLanes: structuredClone(sl),
      overlapGap,
      maxVisibleRows,
    })

    draggingRef.current = {
      type: 'phrase',
      id: phraseIndex,
      startY: e.clientY,
      startPosition: currentPosition,
    }

    const onMove = (moveE: MouseEvent) => {
      const drag = draggingRef.current
      if (!drag || drag.type !== 'phrase') return
      const containerH = getContainerHeight()
      const deltaPercent = ((moveE.clientY - drag.startY) / containerH) * 100
      const newPos = Math.min(95, Math.max(5, drag.startPosition + deltaPercent))
      useSubtitleStore.getState().setPhraseStyle(drag.id as number, { verticalPosition: newPos })
    }

    const onUp = () => {
      draggingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [getContainerHeight, setPhraseStyle])

  // Determine which phrases are currently visible at the current frame
  const currentTimeSec = currentFrame / Math.max(1, fps)
  const visiblePhrases: Array<{ phraseIndex: number; phrase: SessionPhrase; speakerId: string | undefined }> = []

  phrases.forEach((phrase, phraseIndex) => {
    if (phrase.words.length === 0) return
    const start = phrase.words[0].start
    const end = phrase.words[phrase.words.length - 1].end
    if (currentTimeSec >= start && currentTimeSec <= end) {
      visiblePhrases.push({ phraseIndex, phrase, speakerId: phrase.dominantSpeaker ?? undefined })
    }
  })

  return (
    <div className="lane-drag-overlay" aria-hidden="true">
      {/* Per-speaker drag handles */}
      {Object.entries(speakerLanes).map(([speakerId, lane]) => {
        const color = getSpeakerColor(speakerId)
        const displayName = speakerNames[speakerId] ?? speakerId
        return (
          <div
            key={`speaker-${speakerId}`}
            className="lane-drag-overlay__handle lane-drag-overlay__handle--speaker"
            style={{ top: `${lane.verticalPosition}%`, borderTopColor: color }}
            onMouseDown={(e) => handleSpeakerMouseDown(e, speakerId, lane.verticalPosition)}
          >
            <span
              className="lane-drag-overlay__label"
              style={{ background: `${color}33`, color, borderColor: `${color}66` }}
            >
              {displayName}
            </span>
          </div>
        )
      })}

      {/* Per-phrase drag handles — visible only when phrase is active */}
      {visiblePhrases.map(({ phraseIndex, phrase, speakerId }) => {
        const color = speakerId ? getSpeakerColor(speakerId) : '#888888'
        const speakerPosition = speakerId && speakerLanes[speakerId]
          ? speakerLanes[speakerId].verticalPosition
          : 80
        const overridePosition = (phrase.styleOverride as { verticalPosition?: number } | undefined)?.verticalPosition
        const handlePosition = overridePosition ?? speakerPosition
        const textSnippet = phrase.words.slice(0, 3).map((w) => w.word).join(' ')

        return (
          <div
            key={`phrase-${phraseIndex}`}
            className="lane-drag-overlay__handle lane-drag-overlay__handle--phrase"
            style={{ top: `${handlePosition}%`, borderTopColor: color }}
            onMouseDown={(e) => handlePhraseMouseDown(e, phraseIndex, handlePosition)}
          >
            <span
              className="lane-drag-overlay__label lane-drag-overlay__label--phrase"
              style={{ background: `rgba(0,0,0,0.6)`, color, borderColor: `${color}66` }}
            >
              {textSnippet}
              {overridePosition !== undefined && ' *'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
