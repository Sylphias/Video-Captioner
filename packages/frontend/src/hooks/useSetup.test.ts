import { describe, it, expect } from 'vitest'
import { parseSseBuffer } from './useSetup'

describe('parseSseBuffer', () => {
  it('parses complete data frames and skips comment frames', () => {
    const buf =
      ': connected\n\n' +
      'data: {"type":"progress","phase":"downloading","percent":12,"message":"Downloading environment… 12%"}\n\n' +
      'data: {"type":"done"}\n\n'
    const { events, rest } = parseSseBuffer(buf)
    expect(rest).toBe('')
    expect(events).toEqual([
      { type: 'progress', phase: 'downloading', percent: 12, message: 'Downloading environment… 12%' },
      { type: 'done' },
    ])
  })

  it('keeps a partial trailing frame as the remainder', () => {
    const { events, rest } = parseSseBuffer('data: {"type":"done"}\n\ndata: {"type":"er')
    expect(events).toEqual([{ type: 'done' }])
    expect(rest).toBe('data: {"type":"er')
  })

  it('ignores malformed JSON frames', () => {
    const { events } = parseSseBuffer('data: {not json}\n\ndata: {"type":"cancelled"}\n\n')
    expect(events).toEqual([{ type: 'cancelled' }])
  })
})
