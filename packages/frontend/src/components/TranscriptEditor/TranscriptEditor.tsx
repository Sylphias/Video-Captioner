import { useSubtitleStore } from '../../store/subtitleStore.ts'
import { PhraseRow } from './PhraseRow.tsx'
import './TranscriptEditor.css'

interface TranscriptEditorProps {
  seekToTime: (timeSec: number) => void
}

export function TranscriptEditor({ seekToTime }: TranscriptEditorProps) {
  const session = useSubtitleStore((s) => s.session)
  const speakerNames = useSubtitleStore((s) => s.speakerNames)
  const { updateWord, splitPhrase, mergePhrase, addWord, addPhrase, deleteWord, renameSpeaker, reassignWordSpeaker } = useSubtitleStore()

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

  const allSpeakers = Object.keys(speakerNames)
  const hasSpeakers = allSpeakers.length > 0

  return (
    <div className="transcript-editor">
      <div className="transcript-editor__header">
        <span>{session.phrases.length} phrases, {session.words.length} words</span>
        {hasSpeakers && (
          <div className="transcript-editor__speaker-legend">
            {allSpeakers.map((sid) => {
              const idx = parseInt(sid.replace('SPEAKER_', ''), 10) % 8
              return (
                <span key={sid} className="transcript-editor__speaker-tag" data-speaker-index={idx}>
                  <span className="transcript-editor__speaker-swatch" />
                  <input
                    className="transcript-editor__speaker-name-input"
                    value={speakerNames[sid] ?? sid}
                    onChange={(e) => renameSpeaker(sid, e.target.value)}
                  />
                </span>
              )
            })}
          </div>
        )}
      </div>
      <div className="transcript-editor__list">
        {session.phrases.map((phrase, phraseIndex) => {
          const speakerIndex = phrase.dominantSpeaker
            ? parseInt(phrase.dominantSpeaker.replace('SPEAKER_', ''), 10) % 8
            : undefined
          return (
            <div key={phraseIndex}>
              {phraseIndex > 0 && (
                <button
                  className="transcript-editor__insert-phrase-btn"
                  onClick={() => addPhrase(phraseIndex - 1)}
                  title="Insert phrase here"
                >
                  + Insert phrase
                </button>
              )}
              <PhraseRow
                phrase={phrase}
                phraseIndex={phraseIndex}
                globalWordOffset={offsets[phraseIndex]}
                isLast={phraseIndex === session.phrases.length - 1}
                onUpdateText={handleUpdateText}
                onUpdateTimestamp={handleUpdateTimestamp}
                onSplit={splitPhrase}
                onMerge={mergePhrase}
                onAddWord={addWord}
                onDeleteWord={deleteWord}
                onSeek={seekToTime}
                dominantSpeaker={phrase.dominantSpeaker}
                speakerDisplayName={phrase.dominantSpeaker ? speakerNames[phrase.dominantSpeaker] : undefined}
                allSpeakers={allSpeakers}
                speakerNames={speakerNames}
                speakerIndex={speakerIndex}
                onReassignSpeaker={reassignWordSpeaker}
              />
            </div>
          )
        })}
        <button
          className="transcript-editor__add-phrase-btn"
          onClick={() => addPhrase(session.phrases.length - 1)}
        >
          + Add phrase
        </button>
      </div>
    </div>
  )
}
