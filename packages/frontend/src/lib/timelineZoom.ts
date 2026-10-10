/**
 * Pure viewport math shared by the two editor timelines (TimingEditor's
 * scroll-container timeline and the Text stage's MiniTimeline).
 *
 * Both timelines are modelled the same way here: a visible window
 * `[viewStart, viewStart + visibleDuration]` (seconds) over a timeline of
 * `totalDuration` seconds. Each component converts to/from its own
 * representation (scrollLeft + pixels-per-second, or zoomLevel + viewStart).
 */

export type OffscreenSide = 'left' | 'right'

/**
 * Unmodified key that centers either timeline on the playhead. Chosen because
 * no other frontend shortcut uses a bare "C" (existing: Space play/pause,
 * ←/→ phrase nav, Escape, Delete/Backspace, Ctrl/Cmd+1/2/A/D/H/M/S/Z, Tab).
 */
export const JUMP_TO_PLAYHEAD_KEY = 'c'

/** True when keyboard focus is somewhere the user is typing (shortcuts must not fire). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false
  const el = target as HTMLElement
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable === true
  )
}

/** Clamp a window start so the window stays inside `[0, totalDuration]`. */
export function clampViewStart(viewStart: number, visibleDuration: number, totalDuration: number): number {
  const maxStart = Math.max(0, totalDuration - visibleDuration)
  if (!Number.isFinite(viewStart)) return 0
  return Math.min(maxStart, Math.max(0, viewStart))
}

/** Which side of the visible window `time` lies on, or null when it is visible (edges inclusive). */
export function offscreenSide(time: number, viewStart: number, visibleDuration: number): OffscreenSide | null {
  if (time < viewStart) return 'left'
  if (time > viewStart + visibleDuration) return 'right'
  return null
}

/** Window start that centers `time` in a window of `visibleDuration` (clamped). */
export function centeredViewStart(time: number, visibleDuration: number, totalDuration: number): number {
  return clampViewStart(time - visibleDuration / 2, visibleDuration, totalDuration)
}

export interface PlayheadZoomInput {
  /** Current window start (seconds). */
  viewStart: number
  /** Current window length (seconds). */
  visibleDuration: number
  /** Window length after the zoom (seconds). */
  newVisibleDuration: number
  /** Full timeline length (seconds). */
  totalDuration: number
  /** Playhead time (seconds). */
  playheadTime: number
}

/**
 * New window start for a zoom anchored on the playhead.
 *
 * - Playhead visible: it keeps the same fractional on-screen position before
 *   and after the zoom (so it stays put under the user's eye).
 * - Playhead off-screen: the zoomed window is centered on the playhead, so the
 *   user lands at the playhead.
 *
 * The result is clamped into the valid range; near the timeline ends the
 * clamp wins over the anchor (the window cannot scroll past 0 or the end).
 */
export function zoomAnchoredViewStart({
  viewStart,
  visibleDuration,
  newVisibleDuration,
  totalDuration,
  playheadTime,
}: PlayheadZoomInput): number {
  if (visibleDuration <= 0 || offscreenSide(playheadTime, viewStart, visibleDuration) !== null) {
    return centeredViewStart(playheadTime, newVisibleDuration, totalDuration)
  }
  const fraction = (playheadTime - viewStart) / visibleDuration
  return clampViewStart(playheadTime - fraction * newVisibleDuration, newVisibleDuration, totalDuration)
}
