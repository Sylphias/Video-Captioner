import { StylePanel } from './StylePanel/StylePanel.tsx'
import { SpeakerStylePanel } from './StylePanel/SpeakerStylePanel.tsx'
import { PhraseStylePanel } from './StyleDrawer/PhraseStylePanel.tsx'
import './GlobalStyleSidePanel.css'

export type RightPanelMode =
  | { type: 'global' }
  | { type: 'phrase'; phraseIndex: number }
  | { type: 'speaker'; speakerId: string }

interface GlobalStyleSidePanelProps {
  mode: RightPanelMode
  onBack: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function GlobalStyleSidePanel({ mode, onBack, collapsed, onToggleCollapse }: GlobalStyleSidePanelProps) {
  const isGlobal = mode.type === 'global'
  const title = isGlobal ? 'Global Styling' : mode.type === 'phrase' ? 'Phrase Style' : 'Speaker Style'
  const contentKey = isGlobal ? 'global' : `${mode.type}-${mode.type === 'phrase' ? mode.phraseIndex : mode.speakerId}`

  return (
    <div className={`global-style-panel${collapsed ? ' global-style-panel--collapsed' : ''}`}>
      <button
        type="button"
        className="global-style-panel__toggle"
        onClick={isGlobal ? onToggleCollapse : onBack}
      >
        <span>{title}</span>
        <span className="global-style-panel__toggle-arrow">
          {isGlobal ? (collapsed ? '▶' : '◀') : '×'}
        </span>
      </button>

      <div className="global-style-panel__content" key={contentKey}>
        {isGlobal && <StylePanel />}
        {isGlobal && <SpeakerStylePanel />}
        {mode.type === 'phrase' && <PhraseStylePanel phraseIndex={mode.phraseIndex} />}
        {mode.type === 'speaker' && <SpeakerStylePanel singleSpeakerId={mode.speakerId} />}
      </div>
    </div>
  )
}
