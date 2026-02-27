import Fastify from 'fastify'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

import corsPlugin from './plugins/cors.ts'
import multipartPlugin from './plugins/multipart.ts'
import jobStorePlugin from './services/jobStore.ts'
import uploadRoutes from './routes/upload.ts'
import jobRoutes from './routes/jobs.ts'

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

// Register plugins in order: cors → multipart → jobStore → routes
await fastify.register(corsPlugin)
await fastify.register(multipartPlugin)
await fastify.register(jobStorePlugin)

// Register route plugins after store is decorated
await fastify.register(uploadRoutes)
await fastify.register(jobRoutes)

// Health check endpoint
fastify.get('/api/health', async (_request, _reply) => {
  return { status: 'ok' }
})

// Start server — must bind to 0.0.0.0 for LAN access (PLAT-02)
try {
  await fastify.listen({ port: 3001, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
