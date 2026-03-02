import { useSubtitleStore } from '../../store/subtitleStore.ts'
import { PhraseRow } from './PhraseRow.tsx'
import './TranscriptEditor.css'

interface TranscriptEditorProps {
  seekToTime: (timeSec: number) => void
}

export function TranscriptEditor({ seekToTime }: TranscriptEditorProps) {
  const session = useSubtitleStore((s) => s.session)
  const { updateWord, splitPhrase, mergePhrase } = useSubtitleStore()

  if (!session) return null

  const handleUpdateText = (wordIndex: number, newText: string) => {
    updateWord(wordIndex, { word: newText })
  }

  const handleUpdateTimestamp = (wordIndex: number, field: 'start' | 'end', value: number) => {
    updateWord(wordIndex, { [field]: value })
  }

  // Compute cumulative global word offsets for each phrase
  const offsets: number[] = []
  let cumulative = 0
  for (const phrase of session.phrases) {
    offsets.push(cumulative)
    cumulative += phrase.words.length
  }

  return (
    <div className="transcript-editor">
      <div className="transcript-editor__header">
        <span>{session.phrases.length} phrases, {session.words.length} words</span>
      </div>
      <div className="transcript-editor__list">
        {session.phrases.map((phrase, phraseIndex) => (
          <PhraseRow
            key={phraseIndex}
            phrase={phrase}
            phraseIndex={phraseIndex}
            globalWordOffset={offsets[phraseIndex]}
            isLast={phraseIndex === session.phrases.length - 1}
            onUpdateText={handleUpdateText}
            onUpdateTimestamp={handleUpdateTimestamp}
            onSplit={splitPhrase}
            onMerge={mergePhrase}
            onSeek={seekToTime}
          />
        ))}
      </div>
    </div>
  )
}
