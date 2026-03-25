import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import Database from 'better-sqlite3'
import path from 'node:path'
import { DATA_ROOT } from '../index.ts'

// TypeScript module augmentation — gives fastify.lanePresetsDb proper typing everywhere
declare module 'fastify' {
  interface FastifyInstance {
    lanePresetsDb: Database.Database
  }
}

// ── Fastify plugin ────────────────────────────────────────────────────────────

async function lanePresetsPlugin(fastify: FastifyInstance): Promise<void> {
  const dbPath = path.join(DATA_ROOT, 'lane_presets.db')
  const db = new Database(dbPath)

  // Enable WAL journal mode for better concurrent read performance
  db.pragma('journal_mode = WAL')

  // Create table if not exists
  // layout stores JSON: { speakerLanes: Record<string, { verticalPosition: number }>, overlapGap: number, maxVisibleRows: number }
  db.exec(`
    CREATE TABLE IF NOT EXISTS lane_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      layout TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  // Decorate fastify instance with lanePresetsDb (NOT fastify.db — that's taken by animationPresets)
  fastify.decorate('lanePresetsDb', db)

  // Close DB cleanly on server shutdown
  fastify.addHook('onClose', (_instance, done) => {
    db.close()
    done()
  })
}

export default fp(lanePresetsPlugin)
