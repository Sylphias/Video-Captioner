import { useState, useEffect, useRef } from 'react'
import { WordCell } from './WordCell.tsx'
import type { SessionPhrase } from '../../store/subtitleStore.ts'

interface PhraseRowProps {
  phrase: SessionPhrase
  phraseIndex: number
  globalWordOffset: number    // sum of words in all preceding phrases
  isLast: boolean             // true if this is the last phrase (no merge button)
  onUpdateText: (wordIndex: number, newText: string) => void
  onUpdateTimestamp: (wordIndex: number, field: 'start' | 'end', value: number) => void
  onSplit: (phraseIndex: number, splitBeforeWordIndex: number) => void
  onMerge: (phraseIndex: number) => void
  onAddWord: (phraseIndex: number) => void
  onDeleteWord: (wordIndex: number) => void
  onSeek: (timeSec: number) => void
  // Speaker props (optional — omit for single-speaker transcripts)
  dominantSpeaker?: string
  speakerDisplayName?: string
  allSpeakers: string[]
  speakerNames?: Record<string, string>
  speakerIndex?: number
  onReassignSpeaker?: (wordIndex: number, speakerId: string) => void
}

export function PhraseRow({
  phrase,
  phraseIndex,
  globalWordOffset,
  isLast,
  onUpdateText,
  onUpdateTimestamp,
  onSplit,
  onMerge,
  onAddWord,
  onDeleteWord,
  onSeek,
  dominantSpeaker,
  speakerDisplayName,
  allSpeakers,
  speakerNames,
  speakerIndex,
  onReassignSpeaker,
}: PhraseRowProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLSpanElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [showDropdown])

  const rowClass = [
    'phrase-row',
    phrase.isManualSplit ? 'phrase-row--manual' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={rowClass}
      {...(speakerIndex !== undefined ? { 'data-speaker-index': speakerIndex } : {})}
    >
      <span
        className="phrase-row__label"
        onClick={() => onSeek(phrase.words[0].start)}
        title={`Seek to ${phrase.words[0].start.toFixed(2)}s`}
      >
        #{phraseIndex + 1}
      </span>
      {dominantSpeaker && (
        <span
          ref={dropdownRef}
          className="phrase-row__speaker-badge"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          {speakerDisplayName ?? dominantSpeaker}
          {showDropdown && (
            <div className="phrase-row__speaker-dropdown">
              {allSpeakers.map((sid) => (
                <button
                  key={sid}
                  className={`phrase-row__speaker-option ${sid === dominantSpeaker ? 'phrase-row__speaker-option--active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    // Reassign ALL words in this phrase to the selected speaker
                    phrase.words.forEach((_, localIdx) => {
                      onReassignSpeaker?.(globalWordOffset + localIdx, sid)
                    })
                    setShowDropdown(false)
                  }}
                >
                  {speakerNames?.[sid] ?? sid}
                </button>
              ))}
            </div>
          )}
        </span>
      )}
      <div className="phrase-row__words">
        {phrase.words.map((word, localIndex) => (
          <span key={`${globalWordOffset + localIndex}-${word.word}`} className="phrase-row__word-group">
            {localIndex > 0 && (
              <button
                className="split-btn"
                title="Split phrase here"
                onClick={() => onSplit(phraseIndex, localIndex)}
              >
                |
              </button>
            )}
            <WordCell
              key={`${globalWordOffset + localIndex}-${word.word}`}
              word={word}
              wordIndex={globalWordOffset + localIndex}
              onUpdateText={onUpdateText}
              onUpdateTimestamp={onUpdateTimestamp}
              onDeleteWord={onDeleteWord}
              onSeek={onSeek}
            />
          </span>
        ))}
        <button
          className="phrase-row__add-word-btn"
          title="Add word to this phrase"
          onClick={() => onAddWord(phraseIndex)}
        >
          +
        </button>
      </div>
      {!isLast && (
        <button
          className="phrase-row__merge-btn"
          onClick={() => onMerge(phraseIndex)}
        >
          Merge with next
        </button>
      )}
    </div>
  )
}
