import { useCallback } from 'react'
import { StylePanel } from '../StylePanel/StylePanel.tsx'
import { SpeakerStylePanel } from '../StylePanel/SpeakerStylePanel.tsx'
import './StyleDrawer.css'

export type DrawerMode = { type: 'global' }

interface StyleDrawerProps {
  mode: DrawerMode | null
  onClose: () => void
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
          <h3 className="style-drawer__title">Global Styling</h3>
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
          <StylePanel />
          <SpeakerStylePanel />
        </div>
      </aside>
    </>
  )
}
