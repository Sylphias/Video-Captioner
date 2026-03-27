import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import type { ChildProcess } from 'node:child_process'
import path from 'node:path'

import { DATA_ROOT } from '../index.ts'
import { updateJob } from '../services/jobStore.ts'
import { runTranscription } from '../services/transcription.ts'

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

    const job = fastify.jobs.get(jobId)

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

    // Update job status immediately before firing background work
    updateJob(fastify.jobs, jobId, { status: 'transcribing', progress: 0 })

    // Reply 202 Accepted immediately — transcription runs in background
    reply.code(202).send({ jobId, status: 'transcribing' })

    // Fire-and-forget: background transcription pipeline
    const jobDir = path.join(DATA_ROOT, jobId)
    void runTranscriptionPipeline(fastify, jobId, jobDir, numSpeakers)
  })
}

async function runTranscriptionPipeline(
  fastify: FastifyInstance,
  jobId: string,
  jobDir: string,
  numSpeakers?: number,
): Promise<void> {
  try {
    const normalizedPath = path.join(jobDir, 'normalized.mp4')
    const transcriptPath = path.join(jobDir, 'transcript.json')
    const hfToken = process.env.HUGGINGFACE_TOKEN

    const { promise, process: proc } = runTranscription(
      normalizedPath,
      transcriptPath,
      (percent) => {
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

    updateJob(fastify.jobs, jobId, {
      status: 'transcribed',
      progress: 100,
      transcriptPath,
    })
  } catch (err) {
    transcriptionProcesses.delete(jobId)
    const errorMessage = err instanceof Error ? err.message : String(err)
    updateJob(fastify.jobs, jobId, {
      status: 'failed',
      error: errorMessage,
    })
    fastify.log.error({ jobId, err }, 'Transcription pipeline failed')
  }
}

export default fp(transcribeRoutes)
