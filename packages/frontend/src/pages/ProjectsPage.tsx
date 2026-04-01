import { useCallback, useEffect, useState } from 'react'
import type { ProjectRecord } from '@eigen/shared-types'
import { UploadZone } from '../components/UploadZone.tsx'
import { ProjectCard } from '../components/ProjectCard.tsx'
import { useUpload } from '../hooks/useUpload.ts'
import './ProjectsPage.css'

interface ProjectsPageProps {
  onOpenProject: (projectId: string) => void
}

export function ProjectsPage({ onOpenProject }: ProjectsPageProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const { state: uploadState, upload, reset: resetUpload } = useUpload()

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      const data = (await res.json()) as ProjectRecord[]
      setProjects(data)
    } catch {
      // silently fail — empty list shown
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchProjects() }, [fetchProjects])

  // D-10: When upload completes (status = 'ready'), create project and navigate to it
  useEffect(() => {
    if (uploadState.status !== 'ready' || !uploadState.jobId || !uploadState.job) return

    const createAndOpen = async () => {
      const name = uploadState.job!.originalFilename
        ? uploadState.job!.originalFilename.replace(/\.[^.]+$/, '') // strip extension
        : 'Untitled Project'
      const duration = uploadState.job!.metadata?.duration ?? null

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: uploadState.jobId, name, duration }),
      })
      const project = (await res.json()) as ProjectRecord
      resetUpload()
      onOpenProject(project.id)
    }
    void createAndOpen()
  }, [uploadState.status, uploadState.jobId, uploadState.job, resetUpload, onOpenProject])

  const handleFileDrop = useCallback((file: File) => {
    upload(file)
  }, [upload])

  if (loading) return null // brief flash before data loads

  // D-03: Empty state — no projects → show upload dropzone directly
  if (projects.length === 0 && uploadState.status === 'idle') {
    return (
      <div className="projects-page projects-page--empty">
        <h2 className="projects-page__empty-heading">Drop a video to get started</h2>
        <p className="projects-page__empty-body">
          Upload a video file and Eigen will transcribe and caption it automatically.
        </p>
        <UploadZone onFile={handleFileDrop} />
      </div>
    )
  }

  // Upload in progress (from empty state or create-new)
  if (uploadState.status !== 'idle') {
    return (
      <div className="projects-page projects-page--uploading">
        <UploadZone onFile={handleFileDrop} />
        <p className="projects-page__upload-status">
          {uploadState.status === 'uploading' && `Uploading... ${uploadState.progress}%`}
          {uploadState.status === 'normalizing' && 'Normalizing video...'}
          {uploadState.status === 'failed' && `Error: ${uploadState.error}`}
        </p>
      </div>
    )
  }

  // D-01: Card grid with projects + D-02: create-new card at end
  return (
    <div className="projects-page">
      <h2 className="projects-page__heading">Your Projects</h2>
      <div className="projects-page__grid">
        {projects.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            onClick={() => onOpenProject(p.id)}
            onRefresh={fetchProjects}
          />
        ))}
        <button
          className="create-new-card"
          onClick={() => {
            // Show upload zone by triggering a file input
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'video/*'
            input.onchange = () => {
              if (input.files?.[0]) handleFileDrop(input.files[0])
            }
            input.click()
          }}
        >
          <span className="create-new-card__plus">+</span>
          <span className="create-new-card__label">New Project</span>
        </button>
      </div>
    </div>
  )
}
