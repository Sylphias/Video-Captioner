import type { ProjectRecord } from '@eigen/shared-types'
import './ProjectCard.css'

interface ProjectCardProps {
  project: ProjectRecord
  onClick: () => void
  onRefresh: () => void
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

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div
      className="project-card"
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
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
        <span className="project-card__name">{project.name}</span>
        <span className="project-card__date">{formatDate(project.updatedAt)}</span>
        {project.duration != null && (
          <span className="project-card__duration">{formatDuration(project.duration)}</span>
        )}
      </div>
    </div>
  )
}
