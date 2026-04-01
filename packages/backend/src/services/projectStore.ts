import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import Database from 'better-sqlite3'
import path from 'node:path'
import { DATA_ROOT } from '../index.ts'

// TypeScript module augmentation — gives fastify.projectsDb proper typing everywhere
declare module 'fastify' {
  interface FastifyInstance {
    projectsDb: Database.Database
  }
}

// ── Fastify plugin ────────────────────────────────────────────────────────────

async function projectStorePlugin(fastify: FastifyInstance): Promise<void> {
  const dbPath = path.join(DATA_ROOT, 'projects.db')
  const db = new Database(dbPath)

  // Enable WAL journal mode for better concurrent read performance
  db.pragma('journal_mode = WAL')

  // Create table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      name TEXT NOT NULL,
      state_json TEXT,
      duration REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  // Decorate fastify instance with projectsDb (separate from fastify.db and fastify.lanePresetsDb)
  fastify.decorate('projectsDb', db)

  // Close DB cleanly on server shutdown
  fastify.addHook('onClose', (_instance, done) => {
    db.close()
    done()
  })
}

export default fp(projectStorePlugin)
