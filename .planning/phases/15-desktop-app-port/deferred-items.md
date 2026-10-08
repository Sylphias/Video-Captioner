# Phase 15 Deferred Items

- (15-05, pre-existing, out of scope) `packages/frontend/src/store/subtitleStore.test.ts`: 5 failing bulk-action tests
  (mergePhrases x2, deletePhrases x2, duplicatePhrase x1). Fails on the unmodified frontend; unrelated to Plan 05.
- (15-05, pre-existing) `npm run test --workspace packages/frontend` finds no tests when run from the workspace dir
  because its vitest.config.ts uses `root: './packages/frontend'`; run from the repo root with
  `npx vitest run --config packages/frontend/vitest.config.ts`.
