import Fastify from 'fastify'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

import corsPlugin from './plugins/cors.ts'
import multipartPlugin from './plugins/multipart.ts'
import jobStorePlugin from './services/jobStore.ts'
import animationPresetsPlugin from './services/animationPresets.ts'
import lanePresetsPlugin from './services/lanePresets.ts'
import projectStorePlugin from './services/projectStore.ts'
import uploadRoutes from './routes/upload.ts'
import jobRoutes from './routes/jobs.ts'
import transcribeRoutes from './routes/transcribe.ts'
import diarizeRoutes from './routes/diarize.ts'
import renderRoutes from './routes/render.ts'
import waveformRoutes from './routes/waveform.ts'
import presetsRoutes from './routes/presets.ts'
import lanePresetsRoutes from './routes/lanePresets.ts'
import projectsRoutes from './routes/projects.ts'
import { initBundle } from './services/render.ts'

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Settings + SQLite DBs root (D-11). Electron points this at app.getPath('userData');
// dev fallback is the data/ directory at repo root (three levels up from packages/backend/src).
export const DATA_ROOT = process.env.DATA_ROOT ?? path.resolve(__dirname, '../../../data')

// Heavy media root (uploads/renders/thumbnails/job dirs) — user-configurable big-drive folder
// in packaged mode (D-11); defaults to DATA_ROOT so dev behavior is unchanged.
export const MEDIA_ROOT = process.env.MEDIA_ROOT ?? DATA_ROOT

// Ensure data directories exist at startup
mkdirSync(DATA_ROOT, { recursive: true })
mkdirSync(MEDIA_ROOT, { recursive: true })

const fastify = Fastify({
  logger: { level: 'info' },
  bodyLimit: 10 * 1024 * 1024 * 1024, // 10GB — video processing tool, no upload limit
})

// Register plugins in order: cors → multipart → jobStore → animationPresets → lanePresets → routes
await fastify.register(corsPlugin)
await fastify.register(multipartPlugin)
await fastify.register(jobStorePlugin)
await fastify.register(animationPresetsPlugin)
await fastify.register(lanePresetsPlugin)
await fastify.register(projectStorePlugin)

// Register route plugins after store is decorated
await fastify.register(uploadRoutes)
await fastify.register(jobRoutes)
await fastify.register(transcribeRoutes)
await fastify.register(diarizeRoutes)
await fastify.register(renderRoutes)
await fastify.register(waveformRoutes)
await fastify.register(presetsRoutes)
await fastify.register(lanePresetsRoutes)
await fastify.register(projectsRoutes)

// Health check endpoint
fastify.get('/api/health', async (_request, _reply) => {
  return { status: 'ok' }
})

// Bundle Remotion composition once at startup (before listen — takes several seconds)
const bundleStart = Date.now()
await initBundle()
console.log(`Remotion bundle ready in ${Date.now() - bundleStart}ms`)

// Start server — localhost only (D-12); PORT/HOST overridable by the Electron shell
try {
  await fastify.listen({ port: Number(process.env.PORT ?? 3001), host: process.env.HOST ?? '127.0.0.1' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
