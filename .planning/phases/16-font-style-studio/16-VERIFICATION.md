---
phase: 16-font-style-studio
verified: 2026-10-14T00:00:00Z
status: passed
score: 16/16 decisions verified (D-01..D-16); 6/6 plan-06 truths verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase 16: Font Style Studio Verification Report

**Phase Goal:** A dedicated page for designing reusable font/text styles that can be applied to the captioned video, including a 3D extruded shadow style (`shadowType` 'drop' | 'extrude', shipped as a '3D Shadow' preset), with preview/render parity.
**Verified:** 2026-10-14
**Status:** passed
**Re-verification:** No, initial verification

User-requested values that supersede the original plan text were used as the contract: Extrude depth range -100..100, `MAX_EXTRUDE_STEPS = 100`, auto-seed `EXTRUDE_SEED_OFFSET = {x:20, y:40}`. Human UAT (16-06 Task 2) was approved by the user on 2026-10-14 and is treated as verified. The phase has no REQUIREMENTS.md IDs; CONTEXT.md D-01..D-16 are the contract.

## Evidence Run

| Check | Result |
| --- | --- |
| `just build-libs` | PASS |
| remotion-composition `vitest run` | PASS, 2 files, 16 tests |
| backend `vitest run` | PASS, 3 files, 34 tests |
| frontend `vitest run` | 97 pass, 5 fail. All 5 are the known baseline `subtitleStore bulk actions` failures (mergePhrases, deletePhrases, duplicatePhrase); no new failures |
| `tsc --noEmit` frontend and backend | PASS, no output |
| TBD/FIXME/XXX in files changed since phase start | none |
| `fonts.ts` commits since 3b40f3f | none; backend test asserts `FONT_NAMES.length === 26` |

## Decision Verification (D-01..D-16)

| ID | Decision | Status | Evidence |
| --- | --- | --- | --- |
| D-01 | Third top-level tab Style Studio, no open project needed | VERIFIED | `App.tsx` TABS contains `{ id: 'style-studio', label: 'Style Studio' }` and renders `<StyleStudioPage />`. The page only uses `useTextStyles`, not the project store. |
| D-02 | Three columns (library, preview, shared controls) | VERIFIED | `StyleStudioPage.tsx` has `__library` (`StyleLibraryList`), `__preview` (`StylePreview`) and `__controls` (`StyleControls`). The Global panel and the Studio use the same `StyleControls` (505 lines). |
| D-03 | Editable sample text and Dark/Light/Checker/Custom backdrop | VERIFIED | `StylePreview.tsx` has the sample text input, four backdrop buttons and a `HexColorPicker` for Custom. |
| D-04 | Static preview, one highlighted word, real SubtitleOverlay | VERIFIED | The Player has `controls={false}`, `clickToPlay={false}`, `initialFrame=16` (0.53 s, inside word 2 spanning 0.5-1.0 s) and renders `SubtitleOverlay` at 1920x1080. It re-seeks on `inputProps` change so a paused Player repaints. |
| D-05 | Style holds exactly 14 look keys, no layout | VERIFIED | `LOOK_STYLE_KEYS` lists the 14 keys and excludes verticalPosition, laneGap and lingerDuration. `pickLookProps` fills `shadowType: 'drop'`. The backend `TEXT_STYLE_KEYS` drift test passes. |
| D-06 | Drop/Extrude; extrude is solid, zero blur, stacked steps; same SubtitleOverlay for preview and render; legacy defaults to Drop | VERIFIED | `textShadow.ts`: `buildExtrudeShadow` emits at most 100 zero-blur entries. `buildTextShadow` uses a strict `=== 'extrude'` check, so undefined falls to the legacy drop expression, which is character-identical to the pre-phase inline expression (git diff of `SubtitleOverlay.tsx`). `SubtitleOverlay` calls `buildTextShadow(effectiveStyle)`; `effectiveStyle` is `{...style, ...speaker, ...phrase}`, so `shadowType` flows through overrides. The render route passes `style` through untouched. `projectState.ts` merges `DEFAULT_STYLE` (with `shadowType: 'drop'`) under the stored style; there is a legacy-blob regression test. |
| D-07 | Extrude in shadowColor, outline keeps strokeColor, stroke first | VERIFIED | `buildTextShadow` builds the stroke ring with `strokeColor` first, then the extrude in `shadowColor`. Unit tests cover the ordering. |
| D-08 | No new fonts; Studio hides "Other Google Font..." | VERIFIED | `fonts.ts` is unchanged since the phase start. All built-ins use bundled families (test-asserted; 26 fonts). The Studio passes `allowCustomFont={false}`; the Global panel keeps the default `true`. |
| D-09 | Apply style at global, speaker and phrase level | VERIFIED | `StylePicker` is wired in `StylePanel.tsx` (global), `SpeakerStylePanel.tsx` (speaker) and `PhraseStylePanel.tsx` (phrase), each calling `applyLookStyle` with the matching target. |
| D-10 | Apply copies values, no link, one undo step | VERIFIED | `applyLookStyle` makes one `setStyle` / `setSpeakerStyle` / `setPhraseStyle` call with `pickLookProps(props)`, a fresh object with no library id. 6 store-level tests pass. |
| D-11 | "Save as style" in Global panel saves the 14 look keys | VERIFIED | `StylePanel.tsx` calls `buildSaveAsStylePayload(name, store.style)`, which returns `pickLookProps`. The result goes to `createStyle`. |
| D-12 | Compact dropdown, entries drawn in their own style | VERIFIED | `StylePicker.tsx` applies `stylePickerEntryStyle` (font, weight, colour, spacing and `buildTextShadow(scaleLookStyle(...))`, so extrude matches the renderer). |
| D-13 | Built-ins incl. 3D Shadow, Classic, Bold Pop, Minimal | VERIFIED | `textStyleDefaults.ts` has 6 built-ins in order: Classic, 3D Shadow, Bold Pop, Minimal, Neon Glow, Retro Extrude. 3D Shadow is Archivo Black, black stroke 1.5, black extrude 10/10, `shadowType: 'extrude'`. Classic equals the pre-phase default. Re-seeding is idempotent. A live smoke test in 16-06 confirmed `/api/styles` returns 6 styles. |
| D-14 | Built-ins read-only; Duplicate makes an editable copy | VERIFIED | Backend tests: PUT/DELETE on a built-in returns 403; duplicate returns 201 with "(Copy)" and `isBuiltin` false. The UI disables `StyleControls` for built-ins and `handleChange` also rejects them. |
| D-15 | User styles: New, Rename, Duplicate, Delete with confirm; no import/export | VERIFIED | `StyleLibraryList.tsx` and the CRUD routes (`/api/styles`, `:id`, `:id/duplicate`) exist; 34 backend tests cover validation (400/404). The plugin is registered in `index.ts` before the routes. |
| D-16 | Debounced auto-save, no Save button | VERIFIED | `createDebouncedSaver` (700 ms, serialised promise chain) with unit tests. The page flushes on selection change and on unmount. `AutoSaveIndicator` is shown and there is no save button. |

## Plan-level Truths (non-D)

| Truth | Status | Evidence |
| --- | --- | --- |
| Extrude capped at MAX_EXTRUDE_STEPS (100) | VERIFIED | `Math.min(MAX_EXTRUDE_STEPS, ceil(max(|x|,|y|)))`, unit-tested. |
| Extrude depth range -100..100 with Depth X/Y labels and Blur hidden | VERIFIED | `StyleControls.tsx`: `offsetMin/Max = isExtrude ? -100/100 : -20/20`, labels 'Depth X' / 'Depth Y'. The Blur input is shown only in drop mode. |
| Auto-seed 20/40 when switching to Extrude with both offsets under 3 | VERIFIED | `shadowTypePatch` and `EXTRUDE_SEED_OFFSET = {x:20, y:40}`; one patch means one undo step. |
| Speaker/phrase override sliders widened (font size 200, stroke 30) | VERIFIED | Per the 16-05 SUMMARY and the shared controls; spot-checked in the code. |
| Studio never writes to the project store | VERIFIED | `StyleStudio/` imports only `DEFAULT_STYLE` as a constant. |
| Live backend boots, serves built-ins, bundles composition (16-06) | VERIFIED | 16-06 smoke test (port 3999) reported PASS. The wiring was confirmed by code inspection. |

## Behavior-dependent Truths

Preview/render parity (D-06, 3D Shadow vs reference image) and the D-01..D-16 walkthrough were confirmed by the user's human UAT on 2026-10-14. Structurally, parity holds because the preview, the editor Player and the Remotion render all go through `SubtitleOverlay` and `buildTextShadow`. Auto-save ordering and cancellation are covered by `styleLibrary.test.ts`. No items are left PRESENT_BEHAVIOR_UNVERIFIED.

## Anti-Patterns

No TBD/FIXME/XXX markers in files changed by the phase. No stubs found in the Studio, Picker, controls or backend store. The 5 frontend failures are the documented baseline in `subtitleStore.test.ts`, not regressions.

## Deferred / Out of Scope

| Item | Addressed In |
| --- | --- |
| Global Styling panel horizontal overflow | Phase 17 (UI Redesign) |

## Requirements Coverage

REQUIREMENTS.md has no IDs for Phase 16. D-01..D-16 are all declared across plans 16-01..16-06 and all are satisfied. No orphans.

## Gaps Summary

None. The phase goal is achieved: the Style Studio exists, is wired, and persists styles. Styles apply at global, speaker and phrase level. The 3D extrude shadow ships as a built-in preset. Preview and render share one code path.

---

_Verified: 2026-10-14_
_Verifier: Claude (gsd-verifier)_
