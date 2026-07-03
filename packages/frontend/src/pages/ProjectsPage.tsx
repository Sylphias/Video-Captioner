import { useCallback, useEffect, useState } from 'react'
import type { ProjectRecord } from '@eigen/shared-types'
import { UploadZone } from '../components/UploadZone.tsx'
import { TranscriptionOptionsDialog } from '../components/TranscriptionOptionsDialog.tsx'
import { ProjectCard } from '../components/ProjectCard.tsx'
import { ProjectContextMenu } from '../components/ProjectContextMenu.tsx'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog.tsx'
import { useUpload } from '../hooks/useUpload.ts'
import './ProjectsPage.css'

interface ProjectsPageProps {
  onOpenProject: (projectId: string) => void
}

export function ProjectsPage({ onOpenProject }: ProjectsPageProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const { state: uploadState, upload, reset: resetUpload } = useUpload()

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; projectId: string } | null>(null)
  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null)
  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')
  // Transcription options dialog — shown before an upload starts (both upload
  // paths) and before a context-menu re-transcribe. Escape/Cancel aborts the
  // pending action entirely; confirm persists the prefs then proceeds.
  const [transcribeDialog, setTranscribeDialog] = useState<
    { kind: 'upload'; file: File } | { kind: 'retranscribe'; projectId: string } | null
  >(null)

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

  // Uploads go through the transcription-options dialog first — the actual
  // upload only starts once the user confirms words/chars per line.
  const handleFileDrop = useCallback((file: File) => {
    setTranscribeDialog({ kind: 'upload', file })
  }, [])

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, project: ProjectRecord) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, projectId: project.id })
  }, [])

  // Rename flow
  const handleRenameStart = useCallback(() => {
    if (!contextMenu) return
    const project = projects.find((p) => p.id === contextMenu.projectId)
    if (!project) return
    setRenamingId(project.id)
    setRenamingValue(project.name)
  }, [contextMenu, projects])

  const handleRenameCommit = useCallback(async () => {
    if (!renamingId || renamingValue.trim() === '') {
      setRenamingId(null)
      setRenamingValue('')
      return
    }
    try {
      await fetch(`/api/projects/${renamingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renamingValue }),
      })
      await fetchProjects()
    } catch {
      // ignore errors — leave name unchanged
    }
    setRenamingId(null)
    setRenamingValue('')
  }, [renamingId, renamingValue, fetchProjects])

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null)
    setRenamingValue('')
  }, [])

  // Duplicate flow
  const handleDuplicate = useCallback(async () => {
    if (!contextMenu) return
    try {
      await fetch(`/api/projects/${contextMenu.projectId}/duplicate`, {
        method: 'POST',
      })
      await fetchProjects()
    } catch {
      // ignore errors
    }
  }, [contextMenu, fetchProjects])

  // Re-transcribe flow: context menu opens the options dialog; the state
  // clear (which triggers a rebuild on next open) only runs after confirm.
  const handleRetranscribeRequest = useCallback(() => {
    if (!contextMenu) return
    setTranscribeDialog({ kind: 'retranscribe', projectId: contextMenu.projectId })
  }, [contextMenu])

  const performRetranscribe = useCallback(async (projectId: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateJson: null }),
      })
      await fetchProjects()
    } catch {
      // ignore errors
    }
  }, [fetchProjects])

  const handleDialogConfirm = useCallback(() => {
    // Prefs are already persisted by the dialog; setJob reads them when the
    // fresh transcript's phrases are built.
    if (!transcribeDialog) return
    if (transcribeDialog.kind === 'upload') {
      upload(transcribeDialog.file)
    } else {
      void performRetranscribe(transcribeDialog.projectId)
    }
    setTranscribeDialog(null)
  }, [transcribeDialog, upload, performRetranscribe])

  const transcribeDialogEl = transcribeDialog && (
    <TranscriptionOptionsDialog
      title={transcribeDialog.kind === 'upload' ? 'Transcription options' : 'Re-transcribe project'}
      confirmLabel={transcribeDialog.kind === 'upload' ? 'Upload & Transcribe' : 'Re-transcribe'}
      onConfirm={handleDialogConfirm}
      onCancel={() => setTranscribeDialog(null)}
    />
  )

  // Delete flow
  const handleDeleteRequest = useCallback(() => {
    if (!contextMenu) return
    const project = projects.find((p) => p.id === contextMenu.projectId)
    if (!project) return
    setDeleteTarget(project)
  }, [contextMenu, projects])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await fetch(`/api/projects/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      await fetchProjects()
    } catch {
      // ignore errors
    }
    setDeleteTarget(null)
  }, [deleteTarget, fetchProjects])

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
        {transcribeDialogEl}
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
        {transcribeDialogEl}
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
            onContextMenu={(e) => handleContextMenu(e, p)}
            isRenaming={renamingId === p.id}
            renamingValue={renamingValue}
            onRenameChange={setRenamingValue}
            onRenameCommit={handleRenameCommit}
            onRenameCancel={handleRenameCancel}
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

      {contextMenu && (
        <ProjectContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={handleRenameStart}
          onDuplicate={() => { void handleDuplicate() }}
          onRetranscribe={handleRetranscribeRequest}
          onDelete={handleDeleteRequest}
          onClose={() => setContextMenu(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          projectName={deleteTarget.name}
          onConfirm={() => { void handleDeleteConfirm() }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {transcribeDialogEl}
    </div>
  )
}
