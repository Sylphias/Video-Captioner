import fs from 'node:fs'
import path from 'node:path'

/**
 * Job-folder resolution across media roots (Phase 15 gap closure).
 *
 * The media root is user-configurable (D-11) and is read once at startup. Changing it does NOT
 * move existing media, so a job folder may live under the current MEDIA_ROOT, the old default
 * root, or any root a project was created under. Every job-folder path goes through this
 * resolver instead of `path.join(MEDIA_ROOT, jobId)`.
 *
 * Pure module: no Fastify, no index.ts import (so it is unit-testable). The Fastify wiring lives
 * in services/jobDirsPlugin.ts.
 */

/** Job ids are crypto.randomUUID() values. Anything else is rejected (path-traversal guard). */
const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidJobId(jobId: unknown): jobId is string {
  return typeof jobId === 'string' && JOB_ID_RE.test(jobId)
}

export const NORMALIZED_FILE = 'normalized.mp4'

export interface JobDirResolverDeps {
  /** Root new uploads go to (the active MEDIA_ROOT). */
  currentRoot: string
  /** Root recorded for this job in the projects table, if any. Checked first. */
  recordedRoot: (jobId: string) => string | null | undefined
  /** Other roots worth probing, in priority order (default roots, saved setting, roots in the DB). */
  fallbackRoots: () => Array<string | null | undefined>
  /** Called when a job is found in a root that differs from its recorded one (lazy backfill). */
  onResolved?: (jobId: string, root: string) => void
  /** Injected for tests. */
  exists?: (p: string) => boolean
  isDirectory?: (p: string) => boolean
}

export interface JobDirResolver {
  /** Absolute job folder for an existing job, or null when no known root contains it. */
  resolve(jobId: string): string | null
  /** Media root that contains the job, or null. */
  rootOf(jobId: string): string | null
  /** True when the job's normalized.mp4 exists somewhere. */
  hasMedia(jobId: string): boolean
  /** Folder for a brand-new job: always under the current root. Throws on an invalid id. */
  dirForNewJob(jobId: string): string
  /** Drop the cached location (after deleting the folder). */
  forget(jobId: string): void
}

function defaultIsDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** Case-insensitive on Windows so `C:\x` and `c:\X` count as one root. */
function rootKey(root: string): string {
  const resolved = path.resolve(root)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function createJobDirResolver(deps: JobDirResolverDeps): JobDirResolver {
  const exists = deps.exists ?? fs.existsSync
  const isDirectory = deps.isDirectory ?? defaultIsDirectory
  // jobId -> root that contains it
  const cache = new Map<string, string>()

  function candidateRoots(jobId: string): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    const all = [deps.recordedRoot(jobId), deps.currentRoot, ...deps.fallbackRoots()]
    for (const root of all) {
      if (typeof root !== 'string' || root.trim() === '' || !path.isAbsolute(root)) continue
      const key = rootKey(root)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(path.resolve(root))
    }
    return out
  }

  function rootOf(jobId: string): string | null {
    if (!isValidJobId(jobId)) return null

    const cached = cache.get(jobId)
    if (cached !== undefined) {
      if (isDirectory(path.join(cached, jobId))) return cached
      cache.delete(jobId) // folder vanished since it was cached
    }

    const roots = candidateRoots(jobId)
    // Prefer a root whose folder actually holds the media; fall back to a bare folder
    // (e.g. an interrupted upload that never produced normalized.mp4).
    const found =
      roots.find((root) => exists(path.join(root, jobId, NORMALIZED_FILE))) ??
      roots.find((root) => isDirectory(path.join(root, jobId)))
    if (!found) return null

    cache.set(jobId, found)
    const recorded = deps.recordedRoot(jobId)
    if (deps.onResolved && (!recorded || rootKey(recorded) !== rootKey(found))) {
      deps.onResolved(jobId, found)
    }
    return found
  }

  return {
    rootOf,
    resolve(jobId) {
      const root = rootOf(jobId)
      return root === null ? null : path.join(root, jobId)
    },
    hasMedia(jobId) {
      const root = rootOf(jobId)
      return root !== null && exists(path.join(root, jobId, NORMALIZED_FILE))
    },
    dirForNewJob(jobId) {
      if (!isValidJobId(jobId)) throw new Error(`Invalid job id: ${jobId}`)
      const root = path.resolve(deps.currentRoot)
      cache.set(jobId, root)
      return path.join(root, jobId)
    },
    forget(jobId) {
      cache.delete(jobId)
    },
  }
}
