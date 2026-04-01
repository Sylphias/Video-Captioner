import { useEffect, useState } from 'react'
import './AutoSaveIndicator.css'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AutoSaveIndicatorProps {
  status: SaveStatus
}

export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (status === 'idle') {
      setVisible(false)
      return
    }

    setVisible(true)

    if (status === 'saved') {
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [status])

  if (!visible) return null

  return (
    <div className={`auto-save-indicator auto-save-indicator--${status}`}>
      {status === 'saving' && <span className="auto-save-indicator__text">Saving\u2026</span>}
      {status === 'saved' && (
        <>
          <span className="auto-save-indicator__dot" />
          <span className="auto-save-indicator__text">Saved</span>
        </>
      )}
      {status === 'error' && (
        <span className="auto-save-indicator__text">Save failed \u2014 retrying\u2026</span>
      )}
    </div>
  )
}
