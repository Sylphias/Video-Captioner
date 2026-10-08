import treeKill from 'tree-kill'

// Registry of live descendant process IDs (python transcription/diarization, ffmpeg,
// render workers). Single cleanup point so shutdown can reap the whole process tree
// (D-03). On Windows tree-kill runs `taskkill /pid <pid> /T /F`, which also takes down
// grandchildren that a plain child.kill() would leave behind.
const livePids = new Set<number>()

export function registerChild(pid: number): void {
  livePids.add(pid)
}

export function unregisterChild(pid: number): void {
  livePids.delete(pid)
}

export function killAll(signal: string = 'SIGKILL'): Promise<void> {
  const pids = [...livePids]
  livePids.clear()
  return Promise.all(
    pids.map(
      (pid) =>
        new Promise<void>((resolve) => {
          try {
            // Best-effort: ignore errors (process may already have exited)
            treeKill(pid, signal, () => resolve())
          } catch {
            resolve()
          }
        }),
    ),
  ).then(() => undefined)
}
