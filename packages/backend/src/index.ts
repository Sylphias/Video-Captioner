import Fastify from 'fastify'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

import corsPlugin from './plugins/cors.ts'
import multipartPlugin from './plugins/multipart.ts'
import jobStorePlugin from './services/jobStore.ts'
import animationPresetsPlugin from './services/animationPresets.ts'
import uploadRoutes from './routes/upload.ts'
import jobRoutes from './routes/jobs.ts'
import transcribeRoutes from './routes/transcribe.ts'
import diarizeRoutes from './routes/diarize.ts'
import renderRoutes from './routes/render.ts'
import waveformRoutes from './routes/waveform.ts'
import presetsRoutes from './routes/presets.ts'
import { initBundle } from './services/render.ts'

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// data/ directory at repo root (two levels up from packages/backend/src)
export const DATA_ROOT = path.resolve(__dirname, '../../../data')

// Ensure data directory exists at startup
mkdirSync(DATA_ROOT, { recursive: true })

const fastify = Fastify({
  logger: { level: 'info' },
  bodyLimit: 10 * 1024 * 1024 * 1024, // 10GB — video processing tool, no upload limit
})

// Register plugins in order: cors → multipart → jobStore → animationPresets → routes
await fastify.register(corsPlugin)
await fastify.register(multipartPlugin)
await fastify.register(jobStorePlugin)
await fastify.register(animationPresetsPlugin)

// Register route plugins after store is decorated
await fastify.register(uploadRoutes)
await fastify.register(jobRoutes)
await fastify.register(transcribeRoutes)
await fastify.register(diarizeRoutes)
await fastify.register(renderRoutes)
await fastify.register(waveformRoutes)
await fastify.register(presetsRoutes)

// Health check endpoint
fastify.get('/api/health', async (_request, _reply) => {
  return { status: 'ok' }
})

// Bundle Remotion composition once at startup (before listen — takes several seconds)
const bundleStart = Date.now()
await initBundle()
console.log(`Remotion bundle ready in ${Date.now() - bundleStart}ms`)

// Start server — must bind to 0.0.0.0 for LAN access (PLAT-02)
try {
  await fastify.listen({ port: 3001, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
