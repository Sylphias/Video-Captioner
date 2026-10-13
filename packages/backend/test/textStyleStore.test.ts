import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import {
  TEXT_STYLE_KEYS,
  ensureTextStylesSchema,
  seedBuiltinTextStyles,
  validateTextStyleProps,
  listTextStyles,
  getTextStyle,
  createTextStyle,
  updateTextStyle,
  deleteTextStyle,
  duplicateTextStyle,
  type TextStyleProps,
} from '../src/services/textStyleStore.ts'
// Test-only cross-package imports (never imported by backend src: installer ships backend/src only)
import { LOOK_STYLE_KEYS } from '../../remotion-composition/src/lookStyle.ts'
import { getFontFamily } from '../../remotion-composition/src/fonts.ts'
import { FONT_NAMES } from '../../remotion-composition/src/fonts.ts'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  ensureTextStylesSchema(db)
  seedBuiltinTextStyles(db)
})

const validProps = (): TextStyleProps => ({
  fontFamily: 'Inter',
  fontWeight: 700,
  fontSize: 80,
  baseColor: '#FFFFFF',
  highlightColor: '#ffd60a',
  strokeColor: '#000',
  strokeWidth: 4,
  shadowColor: '#000000',
  shadowOffsetX: 3,
  shadowOffsetY: 3,
  shadowBlur: 2,
  shadowType: 'drop',
  letterSpacing: 0,
  wordSpacing: 0,
})

const byName = (name: string) => listTextStyles(db).find((s) => s.name === name)!

describe('text style store: built-ins', () => {
  it('lists six built-ins in D-13 order', () => {
    const list = listTextStyles(db)
    expect(list).toHaveLength(6)
    expect(list.every((s) => s.isBuiltin)).toBe(true)
    expect(list.map((s) => s.name)).toEqual([
      'Classic', '3D Shadow', 'Bold Pop', 'Minimal', 'Neon Glow', 'Retro Extrude',
    ])
  })

  it('seeds idempotently and restores changed definitions', () => {
    seedBuiltinTextStyles(db)
    expect(listTextStyles(db)).toHaveLength(6)
    db.prepare("UPDATE text_styles SET props = '{}' WHERE id = 'builtin-classic'").run()
    seedBuiltinTextStyles(db)
    expect(listTextStyles(db)).toHaveLength(6)
    expect(getTextStyle(db, 'builtin-classic')!.props.fontSize).toBe(90)
  })

  it('D-05 drift: TEXT_STYLE_KEYS equals composition LOOK_STYLE_KEYS', () => {
    expect([...TEXT_STYLE_KEYS].sort()).toEqual([...LOOK_STYLE_KEYS].sort())
    expect(TEXT_STYLE_KEYS).toHaveLength(14)
  })

  it('every built-in has exactly the 14 keys and validates', () => {
    for (const s of listTextStyles(db)) {
      expect(Object.keys(s.props).sort()).toEqual([...TEXT_STYLE_KEYS].sort())
      expect(validateTextStyleProps(s.props).ok).toBe(true)
    }
  })

  it('D-08: built-in fonts are all existing bundled fonts', () => {
    expect(FONT_NAMES.length).toBe(26)
    const families = FONT_NAMES.map(getFontFamily)
    for (const s of listTextStyles(db)) expect(families).toContain(s.props.fontFamily)
  })

  it('D-13: 3D Shadow definition', () => {
    const p = byName('3D Shadow').props
    expect(p.fontFamily).toBe('Archivo Black')
    expect(p.shadowType).toBe('extrude')
    expect(p.strokeColor).toBe('#000000')
    expect(p.strokeWidth).toBe(1.5)
    expect(p.shadowColor).toBe('#000000')
    expect(p.shadowOffsetX).toBe(10)
    expect(p.shadowOffsetY).toBe(10)
  })

  it('D-13: Classic equals the pre-phase default look', () => {
    expect(byName('Classic').props).toEqual({
      fontFamily: getFontFamily('LilitaOne'),
      fontWeight: 400,
      fontSize: 90,
      baseColor: '#FFFFFF',
      highlightColor: '#FFFF00',
      strokeColor: '#000000',
      strokeWidth: 7.5,
      shadowColor: '#000000',
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      shadowBlur: 4,
      shadowType: 'drop',
      letterSpacing: 0,
      wordSpacing: 0,
    })
  })

  it('D-13: Bold Pop and Minimal', () => {
    const bold = byName('Bold Pop').props
    expect(bold.highlightColor).toBe('#FFE600')
    expect(bold.strokeWidth).toBeGreaterThanOrEqual(8)
    const min = byName('Minimal').props
    expect(min.strokeWidth).toBe(0)
    expect(min.shadowType).toBe('drop')
    expect(min.shadowBlur).toBeGreaterThan(0)
  })
})

describe('text style store: create', () => {
  it('creates a user style listed after built-ins', () => {
    const r = createTextStyle(db, { name: 'Mine', props: validProps() })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.isBuiltin).toBe(false)
    expect(r.value.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    const list = listTextStyles(db)
    expect(list).toHaveLength(7)
    expect(list[6].id).toBe(r.value.id)
  })

  it('rejects invalid bodies with 400', () => {
    const p = validProps()
    const { shadowType: _omit, ...noShadowType } = p
    const bad: unknown[] = [
      { props: p },
      { name: '   ', props: p },
      { name: 'x'.repeat(81), props: p },
      { name: 'ok', props: noShadowType },
      { name: 'ok', props: { ...p, verticalPosition: 10 } },
      { name: 'ok', props: { ...p, baseColor: 'red' } },
      { name: 'ok', props: { ...p, baseColor: '#12345' } },
      { name: 'ok', props: { ...p, fontWeight: 950 } },
      { name: 'ok', props: { ...p, fontSize: '90' } },
      { name: 'ok', props: { ...p, fontSize: NaN } },
      { name: 'ok', props: { ...p, shadowType: 'glow' } },
      { name: 'ok', props: { ...p, fontFamily: 'f'.repeat(101) } },
      null,
      'nope',
    ]
    for (const body of bad) {
      const r = createTextStyle(db, body)
      expect(r.ok, JSON.stringify(body)).toBe(false)
      if (!r.ok) expect(r.status).toBe(400)
    }
    expect(listTextStyles(db)).toHaveLength(6)
  })

  it('accepts 3-digit hex colours', () => {
    const r = createTextStyle(db, { name: 'Short', props: { ...validProps(), baseColor: '#fff' } })
    expect(r.ok).toBe(true)
  })

  it('T-16-03: hostile name is stored verbatim', () => {
    const name = "x'); DROP TABLE text_styles; --"
    const r = createTextStyle(db, { name, props: validProps() })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(getTextStyle(db, r.value.id)!.name).toBe(name)
    expect(listTextStyles(db)).toHaveLength(7)
  })
})

describe('text style store: update / delete / duplicate', () => {
  const makeUser = () => {
    const r = createTextStyle(db, { name: 'Mine', props: validProps() }, 1000)
    if (!r.ok) throw new Error('setup failed')
    return r.value
  }

  it('renames (trimmed), bumps updatedAt, and replaces props', () => {
    const u = makeUser()
    const r1 = updateTextStyle(db, u.id, { name: '  Renamed  ' }, 5000)
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    expect(r1.value.name).toBe('Renamed')
    expect(r1.value.updatedAt).toBe(5000)
    expect(r1.value.updatedAt).toBeGreaterThan(u.updatedAt)
    const newProps = { ...validProps(), fontSize: 120 }
    const r2 = updateTextStyle(db, u.id, { props: newProps })
    expect(r2.ok && r2.value.props.fontSize).toBe(120)
  })

  it('D-14: built-in update 403, unknown 404, empty body 400', () => {
    const u = makeUser()
    const a = updateTextStyle(db, 'builtin-classic', { name: 'Hacked' })
    expect(a.ok === false && a.status).toBe(403)
    const b = updateTextStyle(db, 'nope', { name: 'x' })
    expect(b.ok === false && b.status).toBe(404)
    const c = updateTextStyle(db, u.id, {})
    expect(c.ok === false && c.status).toBe(400)
    const d = updateTextStyle(db, u.id, { name: '' })
    expect(d.ok === false && d.status).toBe(400)
  })

  it('delete: built-in 403, unknown 404, user ok', () => {
    const u = makeUser()
    const a = deleteTextStyle(db, 'builtin-classic')
    expect(a.ok === false && a.status).toBe(403)
    const b = deleteTextStyle(db, 'nope')
    expect(b.ok === false && b.status).toBe(404)
    const c = deleteTextStyle(db, u.id)
    expect(c.ok).toBe(true)
    expect(getTextStyle(db, u.id)).toBeNull()
  })

  it('D-14: duplicating a built-in yields an editable copy', () => {
    const r = duplicateTextStyle(db, 'builtin-3d-shadow')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.name).toBe('3D Shadow (Copy)')
    expect(r.value.isBuiltin).toBe(false)
    expect(r.value.props).toEqual(getTextStyle(db, 'builtin-3d-shadow')!.props)
    expect(r.value.id).not.toBe('builtin-3d-shadow')
    const miss = duplicateTextStyle(db, 'nope')
    expect(miss.ok === false && miss.status).toBe(404)
  })
})
