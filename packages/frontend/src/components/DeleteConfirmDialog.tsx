import { useEffect } from 'react'
import './DeleteConfirmDialog.css'

interface DeleteConfirmDialogProps {
  projectName: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({ projectName: _projectName, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      className="delete-confirm-backdrop"
      onClick={onCancel}
    >
      <div
        className="delete-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="delete-confirm-dialog__header">
          <h3>Delete Project?</h3>
        </div>
        <div className="delete-confirm-dialog__body">
          <p>This will permanently delete the project, video files, and all rendered output. This cannot be undone.</p>
        </div>
        <div className="delete-confirm-dialog__footer">
          <button
            className="delete-confirm-dialog__btn delete-confirm-dialog__btn--secondary"
            onClick={onCancel}
          >
            Keep Project
          </button>
          <button
            className="delete-confirm-dialog__btn delete-confirm-dialog__btn--danger"
            onClick={onConfirm}
          >
            Delete Project
          </button>
        </div>
      </div>
    </div>
  )
}
