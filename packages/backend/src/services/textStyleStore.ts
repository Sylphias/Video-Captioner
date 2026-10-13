import type Database from 'better-sqlite3'
import crypto from 'node:crypto'
import { BUILTIN_TEXT_STYLES } from './textStyleDefaults.ts'

/**
 * Pure text-style library store over a better-sqlite3 Database (D-13/14/15).
 * No workspace-package imports: the installer ships backend/src only.
 * All SQL uses prepared statements with bound parameters (T-16-03).
 */

/**
 * D-05 look-style keys. Deliberately duplicates the composition's LOOK_STYLE_KEYS
 * (backend must stay self-contained); test/textStyleStore.test.ts guards drift.
 */
export const TEXT_STYLE_KEYS = [
  'fontFamily',
  'fontWeight',
  'fontSize',
  'baseColor',
  'highlightColor',
  'strokeColor',
  'strokeWidth',
  'shadowColor',
  'shadowOffsetX',
  'shadowOffsetY',
  'shadowBlur',
  'shadowType',
  'letterSpacing',
  'wordSpacing',
] as const

export interface TextStyleProps {
  fontFamily: string
  fontWeight: number
  fontSize: number
  baseColor: string
  highlightColor: string
  strokeColor: string
  strokeWidth: number
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  shadowBlur: number
  shadowType: 'drop' | 'extrude'
  letterSpacing: number
  wordSpacing: number
}

export interface TextStyleRecord {
  id: string
  name: string
  isBuiltin: boolean
  props: TextStyleProps
  createdAt: number
  updatedAt: number
}

export type StoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 403 | 404; error: string }

interface TextStyleRow {
  id: string
  name: string
  is_builtin: number
  props: string
  created_at: number
  updated_at: number
}

type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const COLOR_KEYS = ['baseColor', 'highlightColor', 'strokeColor', 'shadowColor'] as const
const NUMERIC_RANGES: Record<string, [number, number]> = {
  fontSize: [8, 400],
  strokeWidth: [0, 50],
  shadowOffsetX: [-100, 100],
  shadowOffsetY: [-100, 100],
  shadowBlur: [0, 100],
  letterSpacing: [-50, 200],
  wordSpacing: [-50, 200],
}

export function ensureTextStylesSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS text_styles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      props TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
}

/** Idempotent boot seeding: insert missing built-ins, update existing ones in place. */
export function seedBuiltinTextStyles(db: Database.Database, now: number = Date.now()): void {
  const checkStmt = db.prepare('SELECT id FROM text_styles WHERE id = ?')
  const insertStmt = db.prepare(`
    INSERT INTO text_styles (id, name, is_builtin, props, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?, ?)
  `)
  const updateStmt = db.prepare(`
    UPDATE text_styles SET name = ?, props = ?, updated_at = ? WHERE id = ?
  `)
  const n = BUILTIN_TEXT_STYLES.length
  for (let i = 0; i < n; i++) {
    const style = BUILTIN_TEXT_STYLES[i]
    const props = JSON.stringify(style.props)
    if (!checkStmt.get(style.id)) {
      // Staggered timestamps so built-ins sort first (created_at ASC) in a stable order
      const ts = now - (n - i) * 1000
      insertStmt.run(style.id, style.name, props, ts, ts)
    } else {
      updateStmt.run(style.name, props, now, style.id)
    }
  }
}

export function validateStyleName(input: unknown): Validation<string> {
  if (typeof input !== 'string') return { ok: false, error: 'name must be a string' }
  const name = input.trim()
  if (name.length < 1 || name.length > 80) {
    return { ok: false, error: 'name must be 1-80 characters' }
  }
  return { ok: true, value: name }
}

export function validateTextStyleProps(input: unknown): Validation<TextStyleProps> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'props must be an object' }
  }
  const obj = input as Record<string, unknown>
  const allowed = new Set<string>(TEXT_STYLE_KEYS)
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) return { ok: false, error: `Unknown props key: ${key}` }
  }
  for (const key of TEXT_STYLE_KEYS) {
    if (!(key in obj)) return { ok: false, error: `Missing props key: ${key}` }
  }

  for (const key of COLOR_KEYS) {
    const v = obj[key]
    if (typeof v !== 'string' || !HEX_RE.test(v)) {
      return { ok: false, error: `${key} must be a hex colour like #RRGGBB` }
    }
  }

  const family = obj.fontFamily
  if (typeof family !== 'string' || family.trim().length < 1 || family.trim().length > 100) {
    return { ok: false, error: 'fontFamily must be a string of 1-100 characters' }
  }

  const weight = obj.fontWeight
  if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 100 || weight > 900) {
    return { ok: false, error: 'fontWeight must be an integer from 100 to 900' }
  }

  for (const [key, [min, max]] of Object.entries(NUMERIC_RANGES)) {
    const v = obj[key]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      return { ok: false, error: `${key} must be a number from ${min} to ${max}` }
    }
  }

  if (obj.shadowType !== 'drop' && obj.shadowType !== 'extrude') {
    return { ok: false, error: "shadowType must be 'drop' or 'extrude'" }
  }

  const out: Record<string, unknown> = {}
  for (const key of TEXT_STYLE_KEYS) out[key] = obj[key]
  return { ok: true, value: out as unknown as TextStyleProps }
}

function rowToRecord(row: TextStyleRow): TextStyleRecord {
  return {
    id: row.id,
    name: row.name,
    isBuiltin: Boolean(row.is_builtin),
    props: JSON.parse(row.props) as TextStyleProps,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function asObject(body: unknown): Record<string, unknown> | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  return body as Record<string, unknown>
}

export function listTextStyles(db: Database.Database): TextStyleRecord[] {
  const rows = db
    .prepare('SELECT * FROM text_styles ORDER BY created_at ASC, rowid ASC')
    .all() as TextStyleRow[]
  return rows.map(rowToRecord)
}

export function getTextStyle(db: Database.Database, id: string): TextStyleRecord | null {
  const row = db.prepare('SELECT * FROM text_styles WHERE id = ?').get(id) as TextStyleRow | undefined
  return row ? rowToRecord(row) : null
}

export function createTextStyle(
  db: Database.Database,
  body: unknown,
  now: number = Date.now(),
): StoreResult<TextStyleRecord> {
  const obj = asObject(body)
  if (!obj) return { ok: false, status: 400, error: 'Body must be an object' }
  const name = validateStyleName(obj.name)
  if (!name.ok) return { ok: false, status: 400, error: name.error }
  const props = validateTextStyleProps(obj.props)
  if (!props.ok) return { ok: false, status: 400, error: props.error }

  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO text_styles (id, name, is_builtin, props, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?, ?)
  `).run(id, name.value, JSON.stringify(props.value), now, now)
  return { ok: true, value: getTextStyle(db, id)! }
}

export function updateTextStyle(
  db: Database.Database,
  id: string,
  body: unknown,
  now: number = Date.now(),
): StoreResult<TextStyleRecord> {
  const existing = getTextStyle(db, id)
  if (!existing) return { ok: false, status: 404, error: 'Style not found' }
  if (existing.isBuiltin) return { ok: false, status: 403, error: 'Cannot modify built-in styles' }

  const obj = asObject(body)
  if (!obj || (obj.name === undefined && obj.props === undefined)) {
    return { ok: false, status: 400, error: 'Nothing to update' }
  }

  let name = existing.name
  let props = existing.props
  if (obj.name !== undefined) {
    const v = validateStyleName(obj.name)
    if (!v.ok) return { ok: false, status: 400, error: v.error }
    name = v.value
  }
  if (obj.props !== undefined) {
    const v = validateTextStyleProps(obj.props)
    if (!v.ok) return { ok: false, status: 400, error: v.error }
    props = v.value
  }

  db.prepare('UPDATE text_styles SET name = ?, props = ?, updated_at = ? WHERE id = ?')
    .run(name, JSON.stringify(props), now, id)
  return { ok: true, value: getTextStyle(db, id)! }
}

export function deleteTextStyle(db: Database.Database, id: string): StoreResult<{ ok: true }> {
  const existing = getTextStyle(db, id)
  if (!existing) return { ok: false, status: 404, error: 'Style not found' }
  if (existing.isBuiltin) return { ok: false, status: 403, error: 'Cannot delete built-in styles' }
  db.prepare('DELETE FROM text_styles WHERE id = ?').run(id)
  return { ok: true, value: { ok: true } }
}

export function duplicateTextStyle(
  db: Database.Database,
  id: string,
  now: number = Date.now(),
): StoreResult<TextStyleRecord> {
  const source = getTextStyle(db, id)
  if (!source) return { ok: false, status: 404, error: 'Style not found' }
  const newId = crypto.randomUUID()
  db.prepare(`
    INSERT INTO text_styles (id, name, is_builtin, props, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?, ?)
  `).run(newId, `${source.name} (Copy)`, JSON.stringify(source.props), now, now)
  return { ok: true, value: getTextStyle(db, newId)! }
}
