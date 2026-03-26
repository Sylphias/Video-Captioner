import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import Database from 'better-sqlite3'
import path from 'node:path'
import { DATA_ROOT } from '../index.ts'

// TypeScript module augmentation — gives fastify.db proper typing everywhere
declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database
  }
}

// ── Built-in preset definitions ──────────────────────────────────────────────

interface PresetParams {
  enter: {
    type: string
    durationSec: number
    easing: string
    params: Record<string, unknown>
  }
  active: {
    type: string
    cycleDurationSec: number
    intensity: number
  }
  exit: {
    mirrorEnter: boolean
    type: string
    durationSec: number
    easing: string
    params: Record<string, unknown>
  }
  highlightAnimation?: {
    enterPct: number
    enterTracks: unknown[]
  }
}

interface BuiltinPreset {
  id: string
  name: string
  scope: string
  params: PresetParams
}

const BUILTIN_PRESETS: BuiltinPreset[] = [
  {
    id: 'builtin-classic-fade',
    name: 'Classic Fade',
    scope: 'phrase',
    params: {
      enter: { type: 'fade', durationSec: 0.3, easing: 'ease-out', params: {} },
      active: { type: 'none', cycleDurationSec: 1, intensity: 0 },
      exit: { mirrorEnter: true, type: 'fade', durationSec: 0.2, easing: 'ease-in', params: {} },
    },
  },
  {
    id: 'builtin-slide-up',
    name: 'Slide Up',
    scope: 'phrase',
    params: {
      enter: { type: 'slide-up', durationSec: 0.25, easing: 'ease-out-cubic', params: { slideOffsetFraction: 0.15 } },
      active: { type: 'none', cycleDurationSec: 1, intensity: 0 },
      exit: { mirrorEnter: true, type: 'slide-up', durationSec: 0.2, easing: 'ease-out-cubic', params: { slideOffsetFraction: 0.15 } },
    },
  },
  {
    id: 'builtin-pop-in',
    name: 'Pop In',
    scope: 'phrase',
    params: {
      enter: { type: 'pop', durationSec: 0.35, easing: 'spring', params: {} },
      active: { type: 'none', cycleDurationSec: 1, intensity: 0 },
      exit: { mirrorEnter: false, type: 'shrink', durationSec: 0.2, easing: 'ease-in', params: {} },
    },
  },
  {
    id: 'builtin-word-cascade',
    name: 'Word Cascade',
    scope: 'word',
    params: {
      enter: { type: 'word-cascade', durationSec: 0.4, easing: 'ease-out-cubic', params: { staggerFrames: 3 } },
      active: { type: 'none', cycleDurationSec: 1, intensity: 0 },
      exit: { mirrorEnter: false, type: 'fade', durationSec: 0.2, easing: 'ease-in', params: {} },
    },
  },
  {
    id: 'builtin-blur-reveal',
    name: 'Blur Reveal',
    scope: 'phrase',
    params: {
      enter: { type: 'blur-reveal', durationSec: 0.4, easing: 'ease-out', params: {} },
      active: { type: 'none', cycleDurationSec: 1, intensity: 0 },
      exit: { mirrorEnter: true, type: 'blur-reveal', durationSec: 0.3, easing: 'ease-out', params: {} },
    },
  },
  {
    id: 'builtin-jiggle-pop',
    name: 'Jiggle Pop',
    scope: 'phrase',
    params: {
      enter: { type: 'pop', durationSec: 0.3, easing: 'spring', params: {} },
      active: { type: 'jiggle', cycleDurationSec: 0.6, intensity: 0.5 },
      exit: { mirrorEnter: false, type: 'fade', durationSec: 0.15, easing: 'ease-in', params: {} },
    },
  },
  // ── Highlight presets (per-word karaoke animations) ──────────────────────────
  {
    id: 'builtin-highlight-scale',
    name: 'Highlight: Scale',
    scope: 'phrase',
    params: {
      enter: { type: 'none', durationSec: 0, easing: 'linear', params: {} },
      active: { type: 'none', cycleDurationSec: 1, intensity: 0 },
      exit: { mirrorEnter: false, type: 'none', durationSec: 0, easing: 'linear', params: {} },
      highlightAnimation: {
        enterPct: 30,
        enterTracks: [
          { property: 'scale', keyframes: [{ time: 0, value: 1 }, { time: 100, value: 1.15 }], easings: [{ type: 'ease-out' }] },
        ],
      },
    },
  },
  {
    id: 'builtin-highlight-pop',
    name: 'Highlight: Pop',
    scope: 'phrase',
    params: {
      enter: { type: 'none', durationSec: 0, easing: 'linear', params: {} },
      active: { type: 'none', cycleDurationSec: 1, intensity: 0 },
      exit: { mirrorEnter: false, type: 'none', durationSec: 0, easing: 'linear', params: {} },
      highlightAnimation: {
        enterPct: 25,
        enterTracks: [
          { property: 'scale', keyframes: [{ time: 0, value: 1 }, { time: 60, value: 1.25 }, { time: 100, value: 1.12 }], easings: [{ type: 'ease-out' }, { type: 'ease-in-out' }] },
        ],
      },
    },
  },
  {
    id: 'builtin-highlight-lift',
    name: 'Highlight: Lift',
    scope: 'phrase',
    params: {
      enter: { type: 'none', durationSec: 0, easing: 'linear', params: {} },
      active: { type: 'none', cycleDurationSec: 1, intensity: 0 },
      exit: { mirrorEnter: false, type: 'none', durationSec: 0, easing: 'linear', params: {} },
      highlightAnimation: {
        enterPct: 30,
        enterTracks: [
          { property: 'y', keyframes: [{ time: 0, value: 0 }, { time: 100, value: -3 }], easings: [{ type: 'ease-out' }] },
        ],
      },
    },
  },
  {
    id: 'builtin-highlight-bounce',
    name: 'Highlight: Bounce',
    scope: 'phrase',
    params: {
      enter: { type: 'none', durationSec: 0, easing: 'linear', params: {} },
      active: { type: 'none', cycleDurationSec: 1, intensity: 0 },
      exit: { mirrorEnter: false, type: 'none', durationSec: 0, easing: 'linear', params: {} },
      highlightAnimation: {
        enterPct: 35,
        enterTracks: [
          { property: 'y', keyframes: [{ time: 0, value: 0 }, { time: 40, value: -5 }, { time: 70, value: -2 }, { time: 100, value: -3 }], easings: [{ type: 'ease-out' }, { type: 'ease-in' }, { type: 'ease-out' }] },
        ],
      },
    },
  },
]

// ── Seeding helper ────────────────────────────────────────────────────────────

function seedBuiltinPresets(db: Database.Database): void {
  const checkStmt = db.prepare('SELECT id FROM animation_presets WHERE id = ?')
  const insertStmt = db.prepare(`
    INSERT INTO animation_presets (id, name, is_builtin, scope, params, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?, ?, ?)
  `)
  const updateStmt = db.prepare(`
    UPDATE animation_presets SET name = ?, scope = ?, params = ?, updated_at = ? WHERE id = ?
  `)

  const now = Date.now()
  // Use incrementing timestamps so built-ins sort before user presets (created_at ASC)
  for (let i = 0; i < BUILTIN_PRESETS.length; i++) {
    const preset = BUILTIN_PRESETS[i]
    const params = JSON.stringify(preset.params)
    const existing = checkStmt.get(preset.id)
    if (!existing) {
      insertStmt.run(
        preset.id,
        preset.name,
        preset.scope,
        params,
        now - (BUILTIN_PRESETS.length - i) * 1000, // stagger timestamps so ORDER BY created_at is stable
        now - (BUILTIN_PRESETS.length - i) * 1000,
      )
    } else {
      // Update existing built-in presets to pick up definition changes
      updateStmt.run(preset.name, preset.scope, params, now, preset.id)
    }
  }
}

// ── Fastify plugin ────────────────────────────────────────────────────────────

async function animationPresetsPlugin(fastify: FastifyInstance): Promise<void> {
  const dbPath = path.join(DATA_ROOT, 'presets.db')
  const db = new Database(dbPath)

  // Enable WAL journal mode for better concurrent read performance
  db.pragma('journal_mode = WAL')

  // Create table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS animation_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      scope TEXT NOT NULL DEFAULT 'phrase',
      params TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  // Decorate fastify instance with db
  fastify.decorate('db', db)

  // Close DB cleanly on server shutdown
  fastify.addHook('onClose', (_instance, done) => {
    db.close()
    done()
  })

  // Seed built-in presets (idempotent — only inserts missing ones)
  seedBuiltinPresets(db)
}

export default fp(animationPresetsPlugin)
