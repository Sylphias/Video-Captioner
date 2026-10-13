import { pickLookProps } from '@eigen/remotion-composition'
import type { LookStyleProps, StyleProps } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../store/subtitleStore.ts'

/** Where an applied library style lands in the project. */
export type ApplyTarget =
  | { level: 'global' }
  | { level: 'speaker'; speakerId: string }
  | { level: 'phrase'; phraseIndex: number }

/**
 * Copy a library style's 14 look values into the project (D-10).
 *
 * Exactly ONE store call is made, so it is a single undo step and existing layout
 * overrides (e.g. a speaker's verticalPosition) are kept by the store's merge.
 * `pickLookProps` builds a fresh object with only the look keys, so later edits to the
 * source never reach the project and unknown/layout keys never enter project state.
 * No library id is stored (copy, not link).
 */
export function applyLookStyle(target: ApplyTarget, props: LookStyleProps): void {
  const look = pickLookProps(props)
  const store = useSubtitleStore.getState()
  switch (target.level) {
    case 'global':
      store.setStyle(look)
      break
    case 'speaker':
      store.setSpeakerStyle(target.speakerId, look)
      break
    case 'phrase':
      store.setPhraseStyle(target.phraseIndex, look)
      break
  }
}

/** Build the POST body for "Save as style" from the project's current global style (D-11). */
export function buildSaveAsStylePayload(
  name: string,
  style: StyleProps,
): { name: string; props: LookStyleProps } {
  return { name: name.trim(), props: pickLookProps(style) }
}
