import Fastify from 'fastify'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

import corsPlugin from './plugins/cors.ts'
import multipartPlugin from './plugins/multipart.ts'
import jobStorePlugin from './services/jobStore.ts'

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// data/ directory at repo root (two levels up from packages/backend/src)
export const DATA_ROOT = path.resolve(__dirname, '../../../data')

// Ensure data directory exists at startup
mkdirSync(DATA_ROOT, { recursive: true })

const fastify = Fastify({
  logger: { level: 'info' },
})

// Register plugins in order: cors → multipart → jobStore
await fastify.register(corsPlugin)
await fastify.register(multipartPlugin)
await fastify.register(jobStorePlugin)

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
