import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDebouncedSaver, resolveSelection, nextStyleName, STUDIO_AUTOSAVE_DELAY_MS } from './styleLibrary.ts'
import type { SaveStatus } from '../components/AutoSaveIndicator.tsx'

describe('createDebouncedSaver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces repeated schedules for one id and saves only the last value', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createDebouncedSaver<number>(save, STUDIO_AUTOSAVE_DELAY_MS)
    saver.schedule('a', 1)
    saver.schedule('a', 2)
    await vi.advanceTimersByTimeAsync(699)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('a', 2)
  })

  it('fires the pending save immediately when a different id is scheduled', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createDebouncedSaver<number>(save, STUDIO_AUTOSAVE_DELAY_MS)
    saver.schedule('a', 1)
    saver.schedule('b', 5)
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('a', 1)
    await vi.advanceTimersByTimeAsync(700)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('b', 5)
  })

  it('flush saves the pending value now and prevents a later timer save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createDebouncedSaver<number>(save, STUDIO_AUTOSAVE_DELAY_MS)
    saver.schedule('a', 1)
    await saver.flush()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('a', 1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('cancel drops only the matching pending id and pendingId reflects state', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createDebouncedSaver<number>(save, STUDIO_AUTOSAVE_DELAY_MS)
    expect(saver.pendingId()).toBeNull()
    saver.schedule('a', 1)
    expect(saver.pendingId()).toBe('a')
    saver.cancel('b')
    expect(saver.pendingId()).toBe('a')
    saver.cancel('a')
    expect(saver.pendingId()).toBeNull()
    await vi.advanceTimersByTimeAsync(700)
    expect(save).not.toHaveBeenCalled()
  })

  it('reports saving then saved on success, saving then error on failure, and recovers', async () => {
    const statuses: SaveStatus[] = []
    const save = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined)
    const saver = createDebouncedSaver<number>(save, STUDIO_AUTOSAVE_DELAY_MS, (s) => statuses.push(s))

    saver.schedule('a', 1)
    await saver.flush()
    expect(statuses).toEqual(['saving', 'saved'])

    statuses.length = 0
    saver.schedule('a', 2)
    await saver.flush()
    expect(statuses).toEqual(['saving', 'error'])

    statuses.length = 0
    saver.schedule('a', 3)
    await saver.flush()
    expect(statuses).toEqual(['saving', 'saved'])
    expect(save).toHaveBeenCalledTimes(3)
  })

  it('serialises saves so a second save waits for the first to settle', async () => {
    let resolveFirst: () => void = () => {}
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })
    const save = vi.fn().mockImplementationOnce(() => first).mockResolvedValue(undefined)
    const saver = createDebouncedSaver<number>(save, STUDIO_AUTOSAVE_DELAY_MS)

    saver.schedule('a', 1)
    saver.schedule('b', 2) // fires save('a', 1) immediately
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(700) // timer for 'b' fires but must queue behind 'a'
    expect(save).toHaveBeenCalledTimes(1)

    resolveFirst()
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('b', 2)
  })
})

describe('resolveSelection', () => {
  it('keeps the current id when present, else first, else null', () => {
    const list = [{ id: 'x' }, { id: 'y' }]
    expect(resolveSelection(list, 'y')).toBe('y')
    expect(resolveSelection(list, 'gone')).toBe('x')
    expect(resolveSelection(list, null)).toBe('x')
    expect(resolveSelection([], 'y')).toBeNull()
  })
})

describe('nextStyleName', () => {
  it('returns the first unused "New style N" name', () => {
    expect(nextStyleName([])).toBe('New style')
    expect(nextStyleName(['New style'])).toBe('New style 2')
    expect(nextStyleName(['New style', 'New style 2'])).toBe('New style 3')
    expect(nextStyleName(['new style'])).toBe('New style')
  })
})
