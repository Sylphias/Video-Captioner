import { describe, it, expect, vi } from 'vitest'
import path from 'node:path'
import { createJobDirResolver, isValidJobId, type JobDirResolverDeps } from '../src/services/jobDirs.ts'

const JOB = '130fc1db-1111-4222-8333-444455556666'
const NEW_ROOT = path.resolve('/media/new')
const OLD_ROOT = path.resolve('/media/old')
const OTHER_ROOT = path.resolve('/media/other')

/** Fake filesystem: a set of existing files plus the directories implied by them. */
function fakeFs(files: string[], dirs: string[] = []) {
  const fileSet = new Set(files.map((f) => path.resolve(f)))
  const dirSet = new Set(dirs.map((d) => path.resolve(d)))
  for (const f of fileSet) dirSet.add(path.dirname(f))
  return {
    exists: (p: string) => fileSet.has(path.resolve(p)) || dirSet.has(path.resolve(p)),
    isDirectory: (p: string) => dirSet.has(path.resolve(p)),
  }
}

function makeResolver(fs: ReturnType<typeof fakeFs>, overrides: Partial<JobDirResolverDeps> = {}) {
  return createJobDirResolver({
    currentRoot: NEW_ROOT,
    recordedRoot: () => null,
    fallbackRoots: () => [OLD_ROOT, OTHER_ROOT],
    ...fs,
    ...overrides,
  })
}

describe('isValidJobId', () => {
  it('accepts UUIDs and rejects traversal / junk', () => {
    expect(isValidJobId(JOB)).toBe(true)
    expect(isValidJobId('..')).toBe(false)
    expect(isValidJobId('../etc')).toBe(false)
    expect(isValidJobId(`${JOB}/..`)).toBe(false)
    expect(isValidJobId('')).toBe(false)
    expect(isValidJobId(undefined)).toBe(false)
  })
})

describe('createJobDirResolver', () => {
  it('finds a job under an old root when the current root lacks it', () => {
    const r = makeResolver(fakeFs([path.join(OLD_ROOT, JOB, 'normalized.mp4')]))
    expect(r.resolve(JOB)).toBe(path.join(OLD_ROOT, JOB))
    expect(r.hasMedia(JOB)).toBe(true)
  })

  it('prefers the current root when both contain the job', () => {
    const r = makeResolver(fakeFs([
      path.join(OLD_ROOT, JOB, 'normalized.mp4'),
      path.join(NEW_ROOT, JOB, 'normalized.mp4'),
    ]))
    expect(r.rootOf(JOB)).toBe(NEW_ROOT)
  })

  it('checks the recorded root first', () => {
    const r = makeResolver(
      fakeFs([path.join(OLD_ROOT, JOB, 'normalized.mp4'), path.join(NEW_ROOT, JOB, 'normalized.mp4')]),
      { recordedRoot: () => OLD_ROOT },
    )
    expect(r.rootOf(JOB)).toBe(OLD_ROOT)
  })

  it('prefers a folder with media over a bare folder in an earlier root', () => {
    const r = makeResolver(fakeFs(
      [path.join(OLD_ROOT, JOB, 'normalized.mp4')],
      [path.join(NEW_ROOT, JOB)],
    ))
    expect(r.rootOf(JOB)).toBe(OLD_ROOT)
  })

  it('returns null and hasMedia false when no root has the job', () => {
    const r = makeResolver(fakeFs([]))
    expect(r.resolve(JOB)).toBeNull()
    expect(r.hasMedia(JOB)).toBe(false)
  })

  it('reports a bare folder (interrupted upload) as resolvable but without media', () => {
    const r = makeResolver(fakeFs([], [path.join(OLD_ROOT, JOB)]))
    expect(r.resolve(JOB)).toBe(path.join(OLD_ROOT, JOB))
    expect(r.hasMedia(JOB)).toBe(false)
  })

  it('never resolves invalid ids, even if such a folder exists', () => {
    const r = makeResolver(fakeFs([path.join(NEW_ROOT, '..', 'normalized.mp4')], [path.resolve('/media')]))
    expect(r.resolve('..')).toBeNull()
    expect(() => r.dirForNewJob('../x')).toThrow()
  })

  it('backfills the recorded root once, then serves from cache', () => {
    const onResolved = vi.fn()
    const fallbackRoots = vi.fn(() => [OLD_ROOT])
    const r = makeResolver(fakeFs([path.join(OLD_ROOT, JOB, 'normalized.mp4')]), { onResolved, fallbackRoots })
    r.resolve(JOB)
    r.resolve(JOB)
    expect(onResolved).toHaveBeenCalledTimes(1)
    expect(onResolved).toHaveBeenCalledWith(JOB, OLD_ROOT)
    expect(fallbackRoots).toHaveBeenCalledTimes(1)
  })

  it('does not backfill when the recorded root is already right', () => {
    const onResolved = vi.fn()
    const r = makeResolver(fakeFs([path.join(OLD_ROOT, JOB, 'normalized.mp4')]), {
      onResolved,
      recordedRoot: () => OLD_ROOT,
    })
    r.resolve(JOB)
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('re-probes when the cached folder disappears', () => {
    const files = new Set([path.join(OLD_ROOT, JOB, 'normalized.mp4')])
    let dirs = new Set([path.join(OLD_ROOT, JOB)])
    const r = makeResolver({
      exists: (p) => files.has(p) || dirs.has(p),
      isDirectory: (p) => dirs.has(p),
    })
    expect(r.rootOf(JOB)).toBe(OLD_ROOT)
    files.clear()
    dirs = new Set()
    expect(r.rootOf(JOB)).toBeNull()
  })

  it('puts new jobs under the current root', () => {
    const r = makeResolver(fakeFs([]))
    expect(r.dirForNewJob(JOB)).toBe(path.join(NEW_ROOT, JOB))
  })

  it('skips relative and blank roots', () => {
    const r = makeResolver(fakeFs([path.join(path.resolve('rel'), JOB, 'normalized.mp4')]), {
      fallbackRoots: () => ['rel', '', null, undefined],
    })
    expect(r.resolve(JOB)).toBeNull()
  })
})
