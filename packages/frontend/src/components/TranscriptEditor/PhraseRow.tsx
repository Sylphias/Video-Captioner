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
  onSeek: (timeSec: number) => void
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
  onSeek,
}: PhraseRowProps) {
  const rowClass = [
    'phrase-row',
    phrase.isManualSplit ? 'phrase-row--manual' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={rowClass}>
      <span className="phrase-row__label">#{phraseIndex + 1}</span>
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
              onSeek={onSeek}
            />
          </span>
        ))}
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
