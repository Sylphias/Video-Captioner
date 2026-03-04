import { useState, useRef } from 'react'
import type { SessionWord } from '../../store/subtitleStore.ts'

interface WordCellProps {
  word: SessionWord
  wordIndex: number           // global index in session.words
  onUpdateText: (wordIndex: number, newText: string) => void
  onUpdateTimestamp: (wordIndex: number, field: 'start' | 'end', value: number) => void
  onDeleteWord: (wordIndex: number) => void
  onSeek: (timeSec: number) => void
}

export function WordCell({ word, wordIndex, onUpdateText, onUpdateTimestamp, onDeleteWord, onSeek }: WordCellProps) {
  const [text, setText] = useState(word.word)
  const [startStr, setStartStr] = useState(word.start.toFixed(2))
  const [endStr, setEndStr] = useState(word.end.toFixed(2))
  const dragRef = useRef(false)

  const handleTextBlur = () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setText(word.word)
    } else {
      onUpdateText(wordIndex, trimmed)
    }
  }

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.currentTarget.blur()
    }
  }

  const handleStartBlur = () => {
    const parsed = parseFloat(startStr)
    if (isNaN(parsed)) {
      setStartStr(word.start.toFixed(2))
    } else {
      onUpdateTimestamp(wordIndex, 'start', parsed)
    }
  }

  const handleEndBlur = () => {
    const parsed = parseFloat(endStr)
    if (isNaN(parsed)) {
      setEndStr(word.end.toFixed(2))
    } else {
      onUpdateTimestamp(wordIndex, 'end', parsed)
    }
  }

  // Scrubby drag: mousedown+drag on timestamp inputs adjusts value by horizontal movement
  // Click without drag focuses the input for typing as normal
  const handleTimeMouseDown = (field: 'start' | 'end') => (e: React.MouseEvent<HTMLInputElement>) => {
    // Don't interfere if already focused (user is typing)
    if (document.activeElement === e.currentTarget) return

    const startX = e.clientX
    const startVal = field === 'start' ? word.start : word.end
    const setStr = field === 'start' ? setStartStr : setEndStr
    dragRef.current = false

    const onMove = (moveE: MouseEvent) => {
      const deltaX = moveE.clientX - startX
      if (!dragRef.current && Math.abs(deltaX) < 3) return // dead zone
      dragRef.current = true
      document.body.style.cursor = 'ew-resize'
      const newVal = Math.max(0, startVal + deltaX * 0.01)
      setStr(newVal.toFixed(2))
    }

    const onUp = (upE: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''

      if (dragRef.current) {
        // Compute final value from drag delta (same formula as onMove)
        const deltaX = upE.clientX - startX
        const newVal = Math.max(0, startVal + deltaX * 0.01)
        setStr(newVal.toFixed(2))
        onUpdateTimestamp(wordIndex, field, parseFloat(newVal.toFixed(2)))
        // Blur to prevent accidental typing after drag
        e.currentTarget.blur()
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="word-cell" data-word-index={wordIndex} onClick={() => onSeek((word.start + word.end) / 2)}>
      <button
        className="word-cell__delete-btn"
        title="Delete word"
        onClick={(e) => { e.stopPropagation(); onDeleteWord(wordIndex) }}
      >
        &times;
      </button>
      <input
        className="word-cell__text"
        type="text"
        value={text}
        size={Math.max(text.length, 1)}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleTextBlur}
        onKeyDown={handleTextKeyDown}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="word-cell__timestamps">
        <input
          className="word-cell__time-input"
          type="number"
          step="0.01"
          min="0"
          value={startStr}
          onChange={(e) => setStartStr(e.target.value)}
          onBlur={handleStartBlur}
          onMouseDown={handleTimeMouseDown('start')}
          onClick={(e) => e.stopPropagation()}
        />
        <input
          className="word-cell__time-input"
          type="number"
          step="0.01"
          min="0"
          value={endStr}
          onChange={(e) => setEndStr(e.target.value)}
          onBlur={handleEndBlur}
          onMouseDown={handleTimeMouseDown('end')}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
