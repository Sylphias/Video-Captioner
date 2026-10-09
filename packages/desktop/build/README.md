# packages/desktop/build

Everything here except this README is generated or fetched by the packaging pipeline and is
**gitignored** (never commit binaries). `electron-builder` ships these as `extraResources`
(real files outside `app.asar`).

| Path | Produced by | Shipped as |
|------|-------------|------------|
| `bin/ffmpeg.exe`, `bin/ffprobe.exe`, `bin/uv.exe` | `scripts/fetch-binaries.mjs` | `<resources>/bin` |
| `remotion-bundle/` | `scripts/build-remotion-bundle.mjs` | `<resources>/remotion-bundle` |
| `backend/` (backend source + production `node_modules`; `better-sqlite3` rebuilt for Electron's ABI) | `scripts/stage-backend.mjs` | `<resources>/backend` (`node_modules` copied by `scripts/after-pack.cjs`, since electron-builder drops `node_modules` from `extraResources`) |
| (copied straight from the repo: `packages/frontend/dist`, `scripts/*.py`) | `npm run build:frontend`; the Python scripts are checked in | `<resources>/frontend/dist`, `<resources>/scripts` |

## Pinned versions (T-15-81)

| Binary | Version | Source | SHA-256 of the downloaded archive |
|--------|---------|--------|-----------------------------------|
| ffmpeg + ffprobe (static, GPL "essentials", includes libx264) | 9.0.2 | gyan.dev `packages/ffmpeg-9.0.2-essentials_build.zip` (linked from ffmpeg.org/download.html) | `60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba` |
| uv (standalone) | 0.12.6 | astral-sh/uv release asset `uv-x86_64-pc-windows-msvc.zip` | `df7cb9f243eae1621400d4fcf5b1b3d90f20e264ece91b64deb3b0078abca6ef` |

`fetch-binaries.mjs` refuses to extract an archive whose SHA-256 does not match the pin above, and
skips the download entirely when `bin/versions.json` already records the pinned versions.
The ffmpeg build is GPL; its license text is copied to `bin/ffmpeg-LICENSE.txt` and ships with it.

## Refreshing

1. ffmpeg: read the latest release number from `https://www.gyan.dev/ffmpeg/builds/release-version`,
   the checksum from `https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-<ver>-essentials_build.zip.sha256`.
2. uv: take the checksum from the `uv-x86_64-pc-windows-msvc.zip.sha256` asset of the chosen release at
   `https://github.com/astral-sh/uv/releases`.
3. Update the `PINNED` object in `scripts/fetch-binaries.mjs` (version, url, sha256, archive root folder
   for ffmpeg) and the table above, then delete `bin/versions.json` (or run `npm run clean --workspace packages/desktop`)
   and re-run `npm run prebuild --workspace packages/desktop`.

The Remotion bundle is always rebuilt (it is fast, ~10 s) so it can never be stale.

## Notes

- Electron 43 (Node ABI 148) has no prebuilt `better-sqlite3` binary, so `@electron/rebuild` compiles it from source: this needs
  Visual Studio Build Tools (C++ workload) + Python for node-gyp, and `better-sqlite3 >= 12.11.1` (earlier 12.x do not compile against
  Electron 43's V8). The rebuild happens in the staged copy only; the repo's own `node_modules` keeps its system-Node build.
- Full pipeline: `npm run prebuild --workspace @eigen/desktop` then `npm run dist --workspace @eigen/desktop`
  (or `npm run package --workspace @eigen/desktop` for both). Output: `packages/desktop/dist/Eigen-Setup-<version>.exe`.
