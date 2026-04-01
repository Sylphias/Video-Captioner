import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'

import { DATA_ROOT } from '../index.ts'
import { killTranscription } from './transcribe.ts'
import { killDiarization } from './diarize.ts'

async function jobRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/jobs/:jobId — get job info (non-SSE, one-shot)
  fastify.get('/api/jobs/:jobId', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const job = fastify.jobs.get(jobId)
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }
    const { transcriptPath, thumbnailPath, outputPath, ...safeJob } = job
    return reply.send(safeJob)
  })

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

    // Track whether this SSE connection ever observed a running subprocess.
    // Only kill subprocesses on disconnect if THIS connection was watching one —
    // prevents the upload SSE close from killing a just-started transcription.
    let observedTranscribing = false
    let observedDiarizing = false
    const origWrite = reply.raw.write.bind(reply.raw)
    reply.raw.write = function (chunk: any, ...args: any[]) {
      try {
        const str = typeof chunk === 'string' ? chunk : chunk.toString()
        if (str.includes('"transcribing"')) observedTranscribing = true
        if (str.includes('"diarizing"')) observedDiarizing = true
      } catch { /* ignore */ }
      return (origWrite as any)(chunk, ...args)
    }

    // Clean up interval if client disconnects early
    req.raw.on('close', () => {
      clearInterval(interval)
      // Only kill subprocesses if this SSE connection was actively watching them
      if (observedTranscribing) {
        const job = fastify.jobs.get(jobId)
        if (job?.status === 'transcribing') killTranscription(jobId)
      }
      if (observedDiarizing) {
        const job = fastify.jobs.get(jobId)
        if (job?.status === 'diarizing') killDiarization(jobId)
      }
    })
  })

  // GET /api/jobs/:jobId/thumbnail — Serve the thumbnail JPEG
  fastify.get('/api/jobs/:jobId/thumbnail', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }

    // Try in-memory job first, fall back to predictable disk path
    const job = fastify.jobs.get(jobId)
    const thumbPath = job?.thumbnailPath ?? path.join(DATA_ROOT, jobId, 'thumbnail.jpg')

    try {
      await access(thumbPath)
    } catch {
      return reply.code(404).send({ error: 'Thumbnail not found' })
    }

    reply.header('Content-Type', 'image/jpeg')
    return reply.send(createReadStream(thumbPath))
  })

  // GET /api/jobs/:jobId/transcript — Serve transcript JSON content (not the file path)
  fastify.get('/api/jobs/:jobId/transcript', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }

    // Try in-memory job first, fall back to predictable disk path
    const job = fastify.jobs.get(jobId)
    const transcriptPath = job?.transcriptPath ?? path.join(DATA_ROOT, jobId, 'transcript.json')

    try {
      const content = await readFile(transcriptPath, 'utf-8')
      reply.header('Content-Type', 'application/json')
      return reply.send(content)
    } catch {
      return reply.code(404).send({ error: 'Transcript not found' })
    }
  })

  // GET /api/jobs/:jobId/video — Serve normalized video with HTTP Range support for seeking
  fastify.get('/api/jobs/:jobId/video', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const job = fastify.jobs.get(jobId)

    // If job is in memory and still processing, reject
    if (job && (job.status === 'uploading' || job.status === 'normalizing')) {
      return reply.code(404).send({ error: 'Video not ready' })
    }

    // Serve from predictable disk path (works even after server restart)
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
