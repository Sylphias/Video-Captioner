import type { ProjectRecord } from '@eigen/shared-types'
import './ProjectCard.css'

interface ProjectCardProps {
  project: ProjectRecord
  onClick: () => void
  onRefresh: () => void
  onContextMenu: (e: React.MouseEvent) => void
  isRenaming: boolean
  renamingValue: string
  onRenameChange: (val: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
}

function formatDate(epochMs: number): string {
  const d = new Date(epochMs)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function ProjectCard({
  project,
  onClick,
  onContextMenu,
  isRenaming,
  renamingValue,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}: ProjectCardProps) {
  return (
    <div
      className="project-card"
      onClick={isRenaming ? undefined : onClick}
      onContextMenu={onContextMenu}
      onKeyDown={(e) => { if (!isRenaming && e.key === 'Enter') onClick() }}
      role="button"
      tabIndex={0}
    >
      <div className="project-card__thumbnail">
        <img
          src={`/api/jobs/${project.jobId}/thumbnail`}
          alt=""
          className="project-card__img"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>
      <div className="project-card__meta">
        {isRenaming ? (
          <input
            className="project-card__rename-input"
            value={renamingValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameCommit()
              else if (e.key === 'Escape') onRenameCancel()
            }}
            onBlur={onRenameCommit}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="project-card__name">{project.name}</span>
        )}
        <span className="project-card__date">{formatDate(project.updatedAt)}</span>
        {project.duration != null && (
          <span className="project-card__duration">{formatDuration(project.duration)}</span>
        )}
      </div>
    </div>
  )
}
