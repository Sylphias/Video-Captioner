import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import Database from 'better-sqlite3'
import path from 'node:path'
import { DATA_ROOT } from '../index.ts'
import { ensureTextStylesSchema, seedBuiltinTextStyles } from './textStyleStore.ts'

// TypeScript module augmentation — gives fastify.textStylesDb proper typing everywhere
declare module 'fastify' {
  interface FastifyInstance {
    textStylesDb: Database.Database
  }
}

// ── Fastify plugin ────────────────────────────────────────────────────────────

async function textStylesPlugin(fastify: FastifyInstance): Promise<void> {
  const dbPath = path.join(DATA_ROOT, 'text_styles.db')
  const db = new Database(dbPath)

  // Enable WAL journal mode for better concurrent read performance
  db.pragma('journal_mode = WAL')

  ensureTextStylesSchema(db)
  // Idempotent: re-seeds built-ins on every boot, updating changed definitions in place
  seedBuiltinTextStyles(db)

  // Own decorator, decoupled from animation presets (fastify.db) and lane presets
  fastify.decorate('textStylesDb', db)

  // Close DB cleanly on server shutdown
  fastify.addHook('onClose', (_instance, done) => {
    db.close()
    done()
  })
}

export default fp(textStylesPlugin)
