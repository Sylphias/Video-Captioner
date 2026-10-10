# Phase 15 Deferred Items

- (15-05, pre-existing, out of scope) `packages/frontend/src/store/subtitleStore.test.ts`: 5 failing bulk-action tests
  (mergePhrases x2, deletePhrases x2, duplicatePhrase x1). Fails on the unmodified frontend; unrelated to Plan 05.
- (15-05, pre-existing) `npm run test --workspace packages/frontend` finds no tests when run from the workspace dir
  because its vitest.config.ts uses `root: './packages/frontend'`; run from the repo root with
  `npx vitest run --config packages/frontend/vitest.config.ts`.

## Found during 15 gap closure (2026-10-10)

- `packages/backend/src/routes/render.ts` hard-codes `http://localhost:3001/api/jobs/:id/video` as the Remotion videoSrc. This is latent: the desktop app pins `BACKEND_PORT = 3001`. It would break if PORT ever became dynamic, so derive the URL from the listening port/host.
- Recovering a job whose `normalized.mp4` is truncated (crash mid-normalization) returns 404 on open, but the project list can still report `mediaAvailable: true`. Consider validating with ffprobe or a size check in the list.
- Orphan job folders with no project row (e.g. an interrupted upload) are never cleaned up. Consider a startup sweep or a "clean up unused media" action.
