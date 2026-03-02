import { useState } from 'react'
import type { SessionWord } from '../../store/subtitleStore.ts'

interface WordCellProps {
  word: SessionWord
  wordIndex: number           // global index in session.words
  onUpdateText: (wordIndex: number, newText: string) => void
  onUpdateTimestamp: (wordIndex: number, field: 'start' | 'end', value: number) => void
  onSeek: (timeSec: number) => void
}

export function WordCell({ word, wordIndex, onUpdateText, onUpdateTimestamp, onSeek }: WordCellProps) {
  const [text, setText] = useState(word.word)
  const [startStr, setStartStr] = useState(word.start.toFixed(2))
  const [endStr, setEndStr] = useState(word.end.toFixed(2))

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

  return (
    <div className="word-cell" onClick={() => onSeek(word.start)}>
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
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
