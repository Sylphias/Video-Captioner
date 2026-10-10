import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import { access, readFile } from 'node:fs/promises'
import type { Job } from '@eigen/shared-types'

import { createJob } from './jobStore.ts'
import { isValidJobId } from './jobDirs.ts'
import { probeVideo } from './ffmpeg.ts'
import { extractThumbnail } from './thumbnail.ts'

/**
 * Jobs live only in the in-memory fastify.jobs Map, so after a restart (or a crash mid-
 * transcription) every route used to 404 on them even though the media is on disk. This rebuilds
 * the most accurate Job record the job folder supports:
 *
 *   normalized.mp4                   -> 'ready' + probed metadata
 *   + valid transcript.json          -> 'transcribed' + transcriptPath (diarize/render need this)
 *   thumbnail.jpg / output.mp4       -> thumbnailPath / outputPath when present
 *
 * Returns null when the id is not a job id, or no known media root holds its normalized.mp4.
 * A partially-written transcript (crash during the final write) is ignored, so the job comes
 * back as 'ready' and simply transcribes again.
 */
const inFlight = new Map<string, Promise<Job | null>>()

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function hasUsableTranscript(transcriptPath: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(await readFile(transcriptPath, 'utf-8')) as { words?: unknown }
    return Array.isArray(parsed.words)
  } catch {
    return false
  }
}

async function rehydrate(fastify: FastifyInstance, jobId: string): Promise<Job | null> {
  const jobDir = fastify.jobDirs.resolve(jobId)
  if (!jobDir) return null

  const normalizedPath = path.join(jobDir, 'normalized.mp4')
  if (!(await fileExists(normalizedPath))) return null

  let metadata: Job['metadata']
  try {
    metadata = await probeVideo(normalizedPath)
  } catch (err) {
    // Truncated normalized.mp4 (crash mid-normalization): not recoverable as a job
    fastify.log.warn({ jobId, err }, 'Could not probe normalized.mp4 while recovering job')
    return null
  }

  const job: Job = { ...createJob(jobId, ''), status: 'ready', progress: 100, metadata }

  const transcriptPath = path.join(jobDir, 'transcript.json')
  if (await hasUsableTranscript(transcriptPath)) {
    job.status = 'transcribed'
    job.transcriptPath = transcriptPath
  }

  const thumbnailPath = path.join(jobDir, 'thumbnail.jpg')
  if (await fileExists(thumbnailPath)) {
    job.thumbnailPath = thumbnailPath
  } else {
    // Crash between normalize and thumbnail: regenerate it (best effort)
    try {
      await extractThumbnail(normalizedPath, thumbnailPath)
      job.thumbnailPath = thumbnailPath
    } catch (err) {
      fastify.log.warn({ jobId, err }, 'Could not regenerate thumbnail while recovering job')
    }
  }

  const outputPath = path.join(jobDir, 'output.mp4')
  if (await fileExists(outputPath)) job.outputPath = outputPath

  return job
}

/**
 * The in-memory job if present, otherwise one rebuilt from disk (and stored), otherwise null.
 * Concurrent callers for the same id share a single recovery.
 */
export async function getOrRehydrateJob(fastify: FastifyInstance, jobId: string): Promise<Job | null> {
  const existing = fastify.jobs.get(jobId)
  if (existing) return existing
  if (!isValidJobId(jobId)) return null

  let pending = inFlight.get(jobId)
  if (!pending) {
    pending = rehydrate(fastify, jobId).finally(() => inFlight.delete(jobId))
    inFlight.set(jobId, pending)
  }
  const recovered = await pending

  // Another request may have created the job (e.g. a fresh pipeline) while we were probing
  const current = fastify.jobs.get(jobId)
  if (current) return current
  if (recovered) {
    fastify.jobs.set(jobId, recovered)
    fastify.log.info({ jobId, status: recovered.status }, 'Recovered job from disk')
  }
  return recovered
}
