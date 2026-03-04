import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import type { ChildProcess } from 'node:child_process'
import path from 'node:path'

import { DATA_ROOT } from '../index.ts'
import { updateJob } from '../services/jobStore.ts'
import { runDiarization } from '../services/diarization.ts'

// Module-level subprocess tracking (not serializable — kept separate from job store)
const diarizationProcesses = new Map<string, ChildProcess>()

/**
 * Kill any active diarization subprocess for the given jobId.
 * Called from jobs.ts when the SSE client disconnects during diarization.
 */
export function killDiarization(jobId: string): void {
  const proc = diarizationProcesses.get(jobId)
  if (proc) {
    proc.kill()
    diarizationProcesses.delete(jobId)
  }
}

async function diarizeRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/jobs/:jobId/diarize — trigger background speaker diarization
  fastify.post('/api/jobs/:jobId/diarize', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const { numSpeakers } = (req.body as { numSpeakers?: number }) ?? {}

    const job = fastify.jobs.get(jobId)

    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }

    // Diarization only allowed after transcription completes
    if (job.status !== 'transcribed') {
      return reply
        .code(409)
        .send({ error: `Job is in '${job.status}' state — diarization requires 'transcribed' status` })
    }

    // Update job status immediately before firing background work
    updateJob(fastify.jobs, jobId, { status: 'diarizing', progress: 0 })

    // Reply 202 Accepted immediately — diarization runs in background
    reply.code(202).send({ jobId, status: 'diarizing' })

    // Fire-and-forget: background diarization pipeline
    const jobDir = path.join(DATA_ROOT, jobId)
    void runDiarizationPipeline(fastify, jobId, jobDir, numSpeakers)
  })
}

async function runDiarizationPipeline(
  fastify: FastifyInstance,
  jobId: string,
  jobDir: string,
  numSpeakers?: number,
): Promise<void> {
  const hfToken = process.env.HUGGINGFACE_TOKEN

  if (!hfToken) {
    updateJob(fastify.jobs, jobId, {
      status: 'failed',
      error:
        'HUGGINGFACE_TOKEN environment variable not set. Create a read token at https://huggingface.co/settings/tokens and accept the model license at https://huggingface.co/pyannote/speaker-diarization-3.1',
    })
    return
  }

  try {
    const normalizedPath = path.join(jobDir, 'normalized.mp4')
    const transcriptPath = path.join(jobDir, 'transcript.json')

    const { promise, process: proc } = runDiarization(
      normalizedPath,
      transcriptPath,
      hfToken,
      (percent) => {
        updateJob(fastify.jobs, jobId, { progress: percent })
      },
      numSpeakers,
    )

    // Store process handle for zombie prevention
    diarizationProcesses.set(jobId, proc)

    await promise

    diarizationProcesses.delete(jobId)

    // Diarization enriches the transcript — return to 'transcribed' state at 100%
    updateJob(fastify.jobs, jobId, {
      status: 'transcribed',
      progress: 100,
    })
  } catch (err) {
    diarizationProcesses.delete(jobId)
    const errorMessage = err instanceof Error ? err.message : String(err)
    updateJob(fastify.jobs, jobId, {
      status: 'failed',
      error: errorMessage,
    })
    fastify.log.error({ jobId, err }, 'Diarization pipeline failed')
  }
}

export default fp(diarizeRoutes)
