import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'

import { DATA_ROOT } from '../index.ts'
import { killTranscription } from './transcribe.ts'
import { killDiarization } from './diarize.ts'

async function jobRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/jobs/:jobId/status — Server-Sent Events stream of job progress
  fastify.get('/api/jobs/:jobId/status', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }

    // Write SSE headers manually (most reliable approach per plan research notes)
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    // Send initial comment to establish connection
    reply.raw.write(': connected\n\n')

    // Poll job store every 500ms and push SSE events
    const interval = setInterval(() => {
      const job = fastify.jobs.get(jobId)

      if (!job) {
        reply.raw.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`)
        clearInterval(interval)
        reply.raw.end()
        return
      }

      // Strip internal server filesystem paths before broadcasting to client
      const { transcriptPath, thumbnailPath, outputPath, ...safeJob } = job
      reply.raw.write(`data: ${JSON.stringify(safeJob)}\n\n`)

      // Close only on truly terminal states: transcribed, rendered, or failed
      // 'ready' is NOT terminal — SSE stays open through transcription lifecycle
      // Lifecycle: uploading -> normalizing -> ready -> transcribing -> transcribed -> rendering -> rendered
      if (job.status === 'transcribed' || job.status === 'rendered' || job.status === 'failed') {
        clearInterval(interval)
        reply.raw.end()
      }
    }, 500)

    // Clean up interval if client disconnects early
    req.raw.on('close', () => {
      clearInterval(interval)
      // Kill transcription subprocess if still running (prevents zombie — Pitfall 4)
      killTranscription(jobId)
      // Kill diarization subprocess if still running (prevents zombie)
      killDiarization(jobId)
    })
  })

  // GET /api/jobs/:jobId/thumbnail — Serve the thumbnail JPEG
  fastify.get('/api/jobs/:jobId/thumbnail', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }

    const job = fastify.jobs.get(jobId)
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }

    if (!job.thumbnailPath) {
      return reply.code(404).send({ error: 'Thumbnail not yet available' })
    }

    // Verify the thumbnail file actually exists before serving
    try {
      await access(job.thumbnailPath)
    } catch {
      return reply.code(404).send({ error: 'Thumbnail file not found on disk' })
    }

    reply.header('Content-Type', 'image/jpeg')
    return reply.send(createReadStream(job.thumbnailPath))
  })

  // GET /api/jobs/:jobId/transcript — Serve transcript JSON content (not the file path)
  fastify.get('/api/jobs/:jobId/transcript', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const job = fastify.jobs.get(jobId)

    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }
    if (!job.transcriptPath) {
      return reply.code(404).send({ error: 'Transcript not yet available' })
    }

    // Read and serve the transcript file content
    try {
      const content = await readFile(job.transcriptPath, 'utf-8')
      reply.header('Content-Type', 'application/json')
      return reply.send(content)
    } catch {
      return reply.code(404).send({ error: 'Transcript file not found on disk' })
    }
  })

  // GET /api/jobs/:jobId/video — Serve normalized video with HTTP Range support for seeking
  fastify.get('/api/jobs/:jobId/video', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const job = fastify.jobs.get(jobId)

    // Only serve video once normalization is complete
    if (!job || job.status === 'uploading' || job.status === 'normalizing') {
      return reply.code(404).send({ error: 'Video not ready' })
    }

    const normalizedPath = path.join(DATA_ROOT, jobId, 'normalized.mp4')

    // Verify file exists on disk
    try {
      await access(normalizedPath)
    } catch {
      return reply.code(404).send({ error: 'Video file not found on disk' })
    }

    const fileStat = await stat(normalizedPath)
    const fileSize = fileStat.size
    const rangeHeader = (req.headers as Record<string, string | undefined>)['range']

    if (rangeHeader) {
      // Partial content — Range request (browser seeking)
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1
      const chunkSize = end - start + 1

      reply.code(206)
      reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      reply.header('Accept-Ranges', 'bytes')
      reply.header('Content-Length', chunkSize)
      reply.header('Content-Type', 'video/mp4')
      return reply.send(createReadStream(normalizedPath, { start, end }))
    } else {
      // Full file request
      reply.header('Content-Type', 'video/mp4')
      reply.header('Accept-Ranges', 'bytes')
      reply.header('Content-Length', fileSize)
      return reply.send(createReadStream(normalizedPath))
    }
  })
}

export default fp(jobRoutes)
