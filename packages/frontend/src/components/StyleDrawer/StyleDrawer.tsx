import { useCallback } from 'react'
import { StylePanel } from '../StylePanel/StylePanel.tsx'
import { SpeakerStylePanel } from '../StylePanel/SpeakerStylePanel.tsx'
import { PhraseStylePanel } from './PhraseStylePanel.tsx'
import './StyleDrawer.css'

export type DrawerMode =
  | { type: 'global' }
  | { type: 'speaker'; speakerId: string }
  | { type: 'phrase'; phraseIndex: number }

interface StyleDrawerProps {
  mode: DrawerMode | null
  onClose: () => void
}

function getTitle(mode: DrawerMode): string {
  switch (mode.type) {
    case 'global':
      return 'Global Styling'
    case 'speaker':
      return 'Speaker Style'
    case 'phrase':
      return 'Phrase Style'
  }
}

export function StyleDrawer({ mode, onClose }: StyleDrawerProps) {
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  if (!mode) return null

  return (
    <>
      <div className="style-drawer-overlay" onClick={handleOverlayClick} />
      <aside className={`style-drawer style-drawer--open`}>
        <div className="style-drawer__header">
          <h3 className="style-drawer__title">{getTitle(mode)}</h3>
          <button
            className="style-drawer__close-btn"
            onClick={onClose}
            type="button"
            title="Close"
          >
            &times;
          </button>
        </div>
        <div className="style-drawer__body">
          {mode.type === 'global' && (
            <>
              <StylePanel />
              <SpeakerStylePanel />
            </>
          )}
          {mode.type === 'speaker' && (
            <SpeakerStylePanel singleSpeakerId={mode.speakerId} />
          )}
          {mode.type === 'phrase' && (
            <PhraseStylePanel phraseIndex={mode.phraseIndex} />
          )}
        </div>
      </aside>
    </>
  )
}
