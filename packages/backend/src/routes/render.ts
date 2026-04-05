import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import type { TranscriptPhrase, AnimationPreset } from '@eigen/shared-types'
import type { StyleProps, SpeakerStyleOverride, CompositionPhrase } from '@eigen/remotion-composition'

import { DATA_ROOT } from '../index.ts'
import { createJob, updateJob } from '../services/jobStore.ts'
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

    let job = fastify.jobs.get(jobId)

    // Job not in memory (server restarted) — re-hydrate from disk if video exists
    if (!job) {
      const normalizedPath = path.join(DATA_ROOT, jobId, 'normalized.mp4')
      try {
        await access(normalizedPath)
        const metadata = await probeVideo(normalizedPath)
        job = { ...createJob(jobId, ''), status: 'ready', progress: 100, metadata }
        fastify.jobs.set(jobId, job)
      } catch {
        return reply.code(404).send({ error: 'Job not found' })
      }
    }

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
        const normalizedPath = path.join(DATA_ROOT, jobId, 'normalized.mp4')
        job.metadata = await probeVideo(normalizedPath)
        fastify.jobs.set(jobId, job)
      } catch {
        return reply.code(409).send({ error: 'Job metadata not available — video may not have been processed' })
      }
    }

    const outputPath = path.join(DATA_ROOT, jobId, 'output.mp4')

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
    const job = fastify.jobs.get(jobId)

    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }

    if (job.status !== 'rendered' || !job.outputPath) {
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
