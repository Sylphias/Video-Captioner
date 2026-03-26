import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import { createWriteStream, mkdirSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'

import { DATA_ROOT } from '../index.ts'
import { createJob, updateJob } from '../services/jobStore.ts'
import { normalizeVideo, probeVideo } from '../services/ffmpeg.ts'
import { extractThumbnail } from '../services/thumbnail.ts'

async function uploadRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/upload', async (req, reply) => {
    const data = await req.file()
    if (!data) {
      return reply.code(400).send({ error: 'No file provided' })
    }

    // Generate a unique job ID and create job directory
    const jobId = randomUUID()
    const jobDir = path.join(DATA_ROOT, jobId)
    mkdirSync(jobDir, { recursive: true })

    // Determine the original file extension
    const ext = path.extname(data.filename) || '.mp4'
    const originalPath = path.join(jobDir, `original${ext}`)

    // Create job record in store
    const job = createJob(jobId, data.filename)
    fastify.jobs.set(jobId, job)

    // Stream file to disk — never buffer in memory
    await pipeline(data.file, createWriteStream(originalPath))

    // Reply immediately with jobId (202 Accepted)
    reply.code(202).send({ jobId })

    // Fire-and-forget async normalization pipeline
    void runNormalizationPipeline(fastify, jobId, jobDir, originalPath)
  })
}

async function runNormalizationPipeline(
  fastify: FastifyInstance,
  jobId: string,
  jobDir: string,
  originalPath: string
): Promise<void> {
  try {
    // Update status to normalizing
    updateJob(fastify.jobs, jobId, { status: 'normalizing', progress: 0 })

    // Probe original to get duration for progress calculation
    const originalMeta = await probeVideo(originalPath)
    const durationMs = originalMeta.duration * 1000

    const normalizedPath = path.join(jobDir, 'normalized.mp4')

    // Normalize video — always (no VFR detection per Pitfall 7 in research)
    await normalizeVideo(
      originalPath,
      normalizedPath,
      (percent) => {
        updateJob(fastify.jobs, jobId, { progress: percent })
      },
      durationMs
    )

    // Probe the normalized file for accurate metadata
    const metadata = await probeVideo(normalizedPath)

    // Extract thumbnail from normalized video at 1-second mark
    const thumbnailPath = path.join(jobDir, 'thumbnail.jpg')
    await extractThumbnail(normalizedPath, thumbnailPath)

    // Mark job as ready with full metadata
    updateJob(fastify.jobs, jobId, {
      status: 'ready',
      progress: 100,
      metadata,
      thumbnailPath,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    updateJob(fastify.jobs, jobId, {
      status: 'failed',
      error: errorMessage,
    })
    fastify.log.error({ jobId, err }, 'Normalization pipeline failed')
  }
}

export default fp(uploadRoutes)
