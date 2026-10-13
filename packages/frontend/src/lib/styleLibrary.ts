import type { SaveStatus } from '../components/AutoSaveIndicator.tsx'

/** Pause after the last edit before a user style is auto-saved (D-16). */
export const STUDIO_AUTOSAVE_DELAY_MS = 700

/**
 * Keep the current selection if it still exists in the list, otherwise fall back to the
 * first style, or null when the list is empty.
 */
export function resolveSelection(
  styles: ReadonlyArray<{ id: string }>,
  currentId: string | null,
): string | null {
  if (currentId !== null && styles.some((s) => s.id === currentId)) return currentId
  return styles.length > 0 ? styles[0].id : null
}

export interface DebouncedSaver<T> {
  /** Queue a save for `id`. A pending save for a different id is fired immediately first. */
  schedule(id: string, value: T): void
  /** Run any pending save now and wait for every queued save to settle. */
  flush(): Promise<void>
  /** Drop the pending save (all, or only when it belongs to `id`). */
  cancel(id?: string): void
  /** Id of the pending (not yet started) save, if any. */
  pendingId(): string | null
}

/**
 * Debounced, strictly serialised saver. Saves are chained on one promise so they never
 * overlap or reorder (RESEARCH Pitfall 9); a rejected save is reported through onStatus
 * and does not break the chain.
 */
export function createDebouncedSaver<T>(
  save: (id: string, value: T) => Promise<unknown>,
  delayMs: number,
  onStatus?: (status: SaveStatus) => void,
): DebouncedSaver<T> {
  let pending: { id: string; value: T } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let chain: Promise<void> = Promise.resolve()

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  // Move the pending entry onto the save chain; returns the chain tail.
  function run(): Promise<void> {
    clearTimer()
    const entry = pending
    pending = null
    if (entry) {
      chain = chain.then(async () => {
        onStatus?.('saving')
        try {
          await save(entry.id, entry.value)
          onStatus?.('saved')
        } catch (err) {
          console.error('[styleLibrary] auto-save failed:', err)
          onStatus?.('error')
        }
      })
    }
    return chain
  }

  return {
    schedule(id, value) {
      if (pending && pending.id !== id) void run()
      pending = { id, value }
      clearTimer()
      timer = setTimeout(() => {
        void run()
      }, delayMs)
    },
    flush() {
      return run()
    },
    cancel(id) {
      if (!pending) return
      if (id === undefined || pending.id === id) {
        pending = null
        clearTimer()
      }
    },
    pendingId() {
      return pending ? pending.id : null
    },
  }
}
