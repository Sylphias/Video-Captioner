import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import type { TranscriptPhrase, AnimationPreset } from '@eigen/shared-types'
import type { StyleProps, SpeakerStyleOverride, CompositionPhrase } from '@eigen/remotion-composition'

import { updateJob } from '../services/jobStore.ts'
import { getOrRehydrateJob } from '../services/jobRecovery.ts'
import { probeVideo } from '../services/ffmpeg.ts'
import { dispatchRender } from '../services/render.ts'

interface RenderBody {
  phrases: CompositionPhrase[]
  style: StyleProps
  speakerStyles: Record<string, SpeakerStyleOverride>
  animationPreset?: AnimationPreset
  phraseLaneOverrides?: Record<number, number>
}

async function renderRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/jobs/:jobId/render — dispatch a render job to worker thread
  fastify.post('/api/jobs/:jobId/render', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const body = req.body as RenderBody
    const { phrases, style } = body
    const speakerStyles = body.speakerStyles ?? {}
    const animationPreset = body.animationPreset
    const phraseLaneOverrides = body.phraseLaneOverrides

    // Job not in memory (server restarted) — recovered from disk when the video exists
    const job = await getOrRehydrateJob(fastify, jobId)
    // Job folder may live under an older media root (resolver probes every known root)
    const jobDir = fastify.jobDirs.resolve(jobId)
    if (!job || !jobDir) {
      return reply.code(404).send({ error: 'Job not found' })
    }
    const normalizedPath = path.join(jobDir, 'normalized.mp4')

    // Allow render from: transcribed (normal flow), rendered (re-render),
    // or ready (server restarted — job re-hydrated from disk, session loaded on frontend)
    if (job.status !== 'transcribed' && job.status !== 'rendered' && job.status !== 'ready') {
      return reply
        .code(409)
        .send({ error: `Job is in '${job.status}' state — render requires 'transcribed' status` })
    }

    // Re-probe metadata if missing (e.g. server restart hydrated job without metadata)
    if (!job.metadata) {
      try {
        job.metadata = await probeVideo(normalizedPath)
        fastify.jobs.set(jobId, job)
      } catch {
        return reply.code(409).send({ error: 'Job metadata not available — video may not have been processed' })
      }
    }

    // Render next to the source media, in whichever root the job lives
    const outputPath = path.join(jobDir, 'output.mp4')

    // Update job to rendering state before dispatching
    updateJob(fastify.jobs, jobId, { status: 'rendering', progress: 0, outputPath })

    // Build inputProps — videoSrc must be HTTP URL (headless Chrome cannot access filesystem)
    const inputProps = {
      videoSrc: `http://localhost:3001/api/jobs/${jobId}/video`,
      phrases,
      style,
      speakerStyles,
      animationPreset,
      phraseLaneOverrides,
    }

    // Dispatch to worker thread (non-blocking — returns immediately)
    dispatchRender(fastify.jobs, jobId, outputPath, inputProps)

    return reply.code(202).send({ jobId, status: 'rendering' })
  })

  // GET /api/jobs/:jobId/download — serve the rendered MP4 for download
  fastify.get('/api/jobs/:jobId/download', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    // Recovered jobs carry outputPath when a previous session's output.mp4 is on disk
    const job = await getOrRehydrateJob(fastify, jobId)

    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }

    // A render in progress or one that just failed may have left a partial file behind
    if (!job.outputPath || job.status === 'rendering' || job.status === 'failed') {
      return reply.code(404).send({ error: 'Render not complete' })
    }

    // Verify the output file exists on disk
    try {
      await access(job.outputPath)
    } catch {
      return reply.code(404).send({ error: 'Output file not found on disk' })
    }

    reply.header('Content-Disposition', `attachment; filename="output-${jobId}.mp4"`)
    reply.header('Content-Type', 'video/mp4')
    return reply.send(createReadStream(job.outputPath))
  })
}

export default fp(renderRoutes)
