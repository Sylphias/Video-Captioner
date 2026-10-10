import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import type { ChildProcess } from 'node:child_process'
import path from 'node:path'

import { updateJob } from '../services/jobStore.ts'
import { getOrRehydrateJob } from '../services/jobRecovery.ts'
import { runTranscription } from '../services/transcription.ts'
import { watchModelDownload, whisperModelCached } from '../services/modelCache.ts'

const MODEL_DOWNLOAD_FAILED = 'Model download failed — check your internet connection and try again.'

// Module-level subprocess tracking (not serializable — kept separate from job store)
const transcriptionProcesses = new Map<string, ChildProcess>()

/**
 * Kill any active transcription subprocess for the given jobId.
 * Called from jobs.ts when the SSE client disconnects during transcription.
 */
export function killTranscription(jobId: string): void {
  const proc = transcriptionProcesses.get(jobId)
  if (proc) {
    proc.kill()
    transcriptionProcesses.delete(jobId)
  }
}

async function transcribeRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/jobs/:jobId/transcribe — trigger background transcription
  fastify.post('/api/jobs/:jobId/transcribe', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const { numSpeakers } = (req.body as { numSpeakers?: number }) ?? {}

    // Recover jobs lost to a restart/crash (e.g. killed mid-transcription) from disk
    const job = await getOrRehydrateJob(fastify, jobId)

    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }

    // Allow transcription only in ready or transcribed (re-transcription) states
    if (
      job.status === 'uploading' ||
      job.status === 'normalizing' ||
      job.status === 'transcribing'
    ) {
      return reply
        .code(409)
        .send({ error: `Job is currently in '${job.status}' state and cannot be transcribed` })
    }

    // Job folder may live under an older media root (resolver probes every known root)
    const jobDir = fastify.jobDirs.resolve(jobId)
    if (!jobDir) {
      return reply.code(404).send({ error: 'Job media not found' })
    }

    // Update job status immediately before firing background work
    updateJob(fastify.jobs, jobId, { status: 'transcribing', progress: 0 })

    // Reply 202 Accepted immediately — transcription runs in background
    reply.code(202).send({ jobId, status: 'transcribing' })

    // Fire-and-forget: background transcription pipeline
    void runTranscriptionPipeline(fastify, jobId, jobDir, numSpeakers)
  })
}

async function runTranscriptionPipeline(
  fastify: FastifyInstance,
  jobId: string,
  jobDir: string,
  numSpeakers?: number,
): Promise<void> {
  // First run: WhisperX silently downloads large-v3 (~3 GB). Surface it as its own phase with a
  // percent inferred from the HF cache folder (UI-SPEC section 4).
  let downloadingModel = !whisperModelCached()
  let stopDownloadWatch: (() => void) | null = null
  const endDownloadPhase = () => {
    stopDownloadWatch?.()
    stopDownloadWatch = null
    if (downloadingModel) {
      downloadingModel = false
      updateJob(fastify.jobs, jobId, { phase: undefined })
    }
  }

  try {
    const normalizedPath = path.join(jobDir, 'normalized.mp4')
    const transcriptPath = path.join(jobDir, 'transcript.json')
    // App config (Settings screen, D-09) first; env var only as a dev fallback
    const hfToken = fastify.appConfig.getSetting('hfToken') ?? process.env.HUGGINGFACE_TOKEN

    if (downloadingModel) {
      updateJob(fastify.jobs, jobId, { phase: 'downloading_model', progress: 0 })
      stopDownloadWatch = watchModelDownload((percent) => {
        if (downloadingModel) updateJob(fastify.jobs, jobId, { progress: percent })
      })
    }

    const { promise, process: proc } = runTranscription(
      normalizedPath,
      transcriptPath,
      (percent, status) => {
        if (downloadingModel) {
          // The script reports 0% / loading_model while the download runs; the watcher owns
          // progress until the script moves on to the next phase.
          if (status === undefined || status === 'loading_model') return
          endDownloadPhase()
        }
        updateJob(fastify.jobs, jobId, { progress: percent })
      },
      'en',
      hfToken,
      numSpeakers,
    )

    // Store process handle on job for zombie prevention
    // WeakMap not used — string keys require a Map; ChildProcess is NOT put in job store
    transcriptionProcesses.set(jobId, proc)

    await promise

    transcriptionProcesses.delete(jobId)
    endDownloadPhase()

    updateJob(fastify.jobs, jobId, {
      status: 'transcribed',
      progress: 100,
      transcriptPath,
    })
  } catch (err) {
    transcriptionProcesses.delete(jobId)
    // Still no complete model on disk after a failure mid-download: most likely the network.
    const downloadFailed = downloadingModel && !whisperModelCached()
    endDownloadPhase()
    const errorMessage = downloadFailed
      ? MODEL_DOWNLOAD_FAILED
      : err instanceof Error
        ? err.message
        : String(err)
    updateJob(fastify.jobs, jobId, {
      status: 'failed',
      error: errorMessage,
    })
    fastify.log.error({ jobId, err }, 'Transcription pipeline failed')
  }
}

export default fp(transcribeRoutes)
