import { useEffect, useRef } from 'react'
import './ProjectContextMenu.css'

interface ProjectContextMenuProps {
  x: number
  y: number
  onRename: () => void
  onDuplicate: () => void
  onRetranscribe: () => void
  onDelete: () => void
  onClose: () => void
}

export function ProjectContextMenu({
  x,
  y,
  onRename,
  onDuplicate,
  onRetranscribe,
  onDelete,
  onClose,
}: ProjectContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="project-context-menu"
      style={{ position: 'fixed', left: x, top: y }}
    >
      <button
        className="project-context-menu__item"
        onClick={() => { onRename(); onClose() }}
      >
        Rename
      </button>
      <button
        className="project-context-menu__item"
        onClick={() => { onDuplicate(); onClose() }}
      >
        Duplicate
      </button>
      <button
        className="project-context-menu__item"
        onClick={() => { onRetranscribe(); onClose() }}
      >
        Re-transcribe
      </button>
      <div className="project-context-menu__separator" />
      <button
        className="project-context-menu__item project-context-menu__item--danger"
        onClick={() => { onDelete(); onClose() }}
      >
        Delete
      </button>
    </div>
  )
}
