import { diffWords } from 'diff'
import type { AlignedPhrase } from '../../lib/srtAlignment.ts'
import './SrtDiffView.css'

interface SrtDiffViewProps {
  alignedPhrases: AlignedPhrase[]
  onAccept: (alignedIndex: number) => void
  onReject: (alignedIndex: number) => void
  onDismiss: () => void
}

function renderDiff(whisperText: string, srtText: string, side: 'whisper' | 'srt'): React.ReactNode[] {
  const parts = diffWords(whisperText, srtText)
  return parts.map((part, i) => {
    if (part.added && side === 'srt') {
      return <mark key={i} className="srt-diff__added">{part.value}</mark>
    }
    if (part.removed && side === 'whisper') {
      return <s key={i} className="srt-diff__removed">{part.value}</s>
    }
    if (part.added && side === 'whisper') {
      // Skip additions in whisper column
      return null
    }
    if (part.removed && side === 'srt') {
      // Skip removals in srt column
      return null
    }
    return <span key={i}>{part.value}</span>
  })
}

export function SrtDiffView({ alignedPhrases, onAccept, onReject, onDismiss }: SrtDiffViewProps) {
  const count = alignedPhrases.length
  const phraseWord = count === 1 ? 'phrase' : 'phrases'

  return (
    <div className="srt-diff">
      <div className="srt-diff__header">
        <h3 className="srt-diff__title">SRT Diff Review</h3>
        <p className="srt-diff__subtitle">
          {count} {phraseWord} matched &mdash; accept or reject each correction
        </p>
        <button
          type="button"
          className="srt-diff__dismiss"
          aria-label="Discard SRT diff"
          onClick={onDismiss}
        >
          {'\u00D7'}
        </button>
      </div>

      {count === 0 ? (
        <div className="srt-diff__empty">
          <p>No matching phrases found.</p>
          <p>Check that the SRT timestamps overlap with the transcript.</p>
        </div>
      ) : (
        <>
          <div className="srt-diff__columns">
            <span />
            <span>Whisper</span>
            <span>SRT</span>
            <span />
          </div>
          <div className="srt-diff__scroll">
            {alignedPhrases.map((aligned, alignedIndex) => (
              <div key={aligned.phraseIndex} className="srt-diff__row">
                <span className="srt-diff__line-num">{aligned.phraseIndex + 1}</span>
                <div className="srt-diff__col srt-diff__col--whisper">
                  {renderDiff(aligned.whisperText, aligned.srtText, 'whisper')}
                </div>
                <div className="srt-diff__col srt-diff__col--srt">
                  {renderDiff(aligned.whisperText, aligned.srtText, 'srt')}
                </div>
                <div className="srt-diff__actions">
                  <button
                    type="button"
                    className="srt-diff__accept"
                    onClick={() => onAccept(alignedIndex)}
                  >
                    Accept Correction
                  </button>
                  <button
                    type="button"
                    className="srt-diff__reject"
                    onClick={() => onReject(alignedIndex)}
                  >
                    Reject Change
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
