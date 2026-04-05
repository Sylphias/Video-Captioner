import { PhraseStylePanel } from './StyleDrawer/PhraseStylePanel.tsx'
import { SpeakerStylePanel } from './StylePanel/SpeakerStylePanel.tsx'
import './PhraseStyleSidePanel.css'

export type RightPanelMode =
  | { type: 'phrase'; phraseIndex: number }
  | { type: 'speaker'; speakerId: string }

interface StyleSidePanelProps {
  mode: RightPanelMode
  onClose: () => void
}

export function StyleSidePanel({ mode, onClose }: StyleSidePanelProps) {
  const title = mode.type === 'phrase' ? 'Phrase Style' : 'Speaker Style'

  return (
    <div className="phrase-side-panel" key={`${mode.type}-${mode.type === 'phrase' ? mode.phraseIndex : mode.speakerId}`}>
      <button
        type="button"
        className="phrase-side-panel__toggle"
        onClick={onClose}
      >
        <span>{title}</span>
        <span className="phrase-side-panel__toggle-arrow">{'\u25B6'}</span>
      </button>

      <div className="phrase-side-panel__content">
        {mode.type === 'phrase' && (
          <PhraseStylePanel phraseIndex={mode.phraseIndex} />
        )}
        {mode.type === 'speaker' && (
          <SpeakerStylePanel singleSpeakerId={mode.speakerId} />
        )}
      </div>
    </div>
  )
}
