---
phase: 01-foundation
plan: 03
subsystem: ui
tags: [react, vite, typescript, css-custom-properties, dark-theme]

# Dependency graph
requires:
  - phase: 01-01
    provides: npm workspaces monorepo, @eigen/frontend package scaffold with React/Vite deps installed
provides:
  - Vite dev server on 0.0.0.0:5173 with /api proxy to localhost:3001
  - Dark theme design tokens as CSS custom properties (DaVinci Resolve aesthetic)
  - App shell with Header + main layout and tab navigation
  - Header component: "Eigen Video Editor" left, TabNav right, 48px fixed height
  - TabNav: button-based (no page reload), green accent underline on active tab
  - SubtitlesPage: centered placeholder ready for Plan 04 UploadZone replacement
affects:
  - 01-04 (integration testing uses frontend dev server)
  - 02-x (upload UI, subtitle editor, preview player build on this shell)
  - 03-x (Remotion composition will integrate with this frontend)

# Tech tracking
tech-stack:
  added:
    - vite@5.4.x (already in package.json, now wired with vite.config.ts + index.html)
    - "@vitejs/plugin-react@4.3.x (React plugin for Vite)"
    - react@18.3.x + react-dom (createRoot pattern with StrictMode)
  patterns:
    - "CSS custom properties on :root in tokens.css — all colors/spacing are design tokens"
    - "CSS import chain: main.tsx imports global.css which @imports tokens.css"
    - "Co-located .css files per component (Header.css, TabNav.css, SubtitlesPage.css, App.css)"
    - "Button-based tab navigation — no <a> tags, no page reload, useState for active tab"
    - "No hard-coded hex values in .tsx files — all colors via var(--color-*)"

key-files:
  created:
    - packages/frontend/vite.config.ts (Vite config: React plugin, host:true, port 5173, /api proxy)
    - packages/frontend/index.html (HTML entry: #root div, module script to src/main.tsx)
    - packages/frontend/src/main.tsx (createRoot render of App, imports global.css)
    - packages/frontend/src/styles/tokens.css (dark theme CSS custom properties)
    - packages/frontend/src/styles/global.css (reset + dark body styles + scrollbars + focus ring)
    - packages/frontend/src/App.tsx (root component: useState activeTab, Header + main layout)
    - packages/frontend/src/App.css (full-height flex column, scrollable main)
    - packages/frontend/src/components/Header.tsx (48px header bar with app name + TabNav)
    - packages/frontend/src/components/Header.css (flex space-between, elevated bg, border-bottom)
    - packages/frontend/src/components/TabNav.tsx (button tabs with aria-selected, onTabChange)
    - packages/frontend/src/components/TabNav.css (green accent border-bottom on active tab)
    - packages/frontend/src/pages/SubtitlesPage.tsx (centered placeholder text)
    - packages/frontend/src/pages/SubtitlesPage.css (flex:1, center alignment)
  modified: []

key-decisions:
  - "Dark mode is the ONLY mode — no class-based toggle, dark styles applied directly on :root and body"
  - "Co-located .css files per component rather than CSS modules or styled-components — keeps stack minimal"
  - "Single Subtitles tab only — no placeholder/coming-soon tabs per user decision"
  - "global.css @imports tokens.css directly — maintains token-first load order without relying on JS import order"

patterns-established:
  - "All component colors use var(--color-*) from tokens.css — no hard-coded hex in .tsx files"
  - "Tab navigation via useState + button elements — no router dependency for single-page tab switching"
  - "SubtitlesPage is a placeholder — Plan 04 replaces inner content with real UploadZone component"

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 1 Plan 03: Frontend Shell Summary

**React + Vite dark-themed app shell with DaVinci Resolve aesthetic: design token system, Header with tab navigation, and SubtitlesPage placeholder — served on 0.0.0.0:5173 with /api proxy**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T15:38:42Z
- **Completed:** 2026-02-25T15:41:11Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Vite dev server configured with host:true (LAN accessible), port 5173, and /api proxy to localhost:3001
- Complete dark theme design token system (40+ CSS custom properties) covering backgrounds, borders, text, green accents, semantic colors, typography, spacing, and transitions
- App shell with Header (app name + button-based TabNav) and SubtitlesPage (centered placeholder) — all colors via CSS custom properties, no hard-coded hex

## Task Commits

Each task was committed atomically:

1. **Task 1: Vite config, dark theme tokens, global styles, and HTML entry point** - `da96b32` (feat)
2. **Task 2: Header, TabNav, App shell, and SubtitlesPage** - `bda73a2` (feat)

## Files Created/Modified

- `packages/frontend/vite.config.ts` - Vite config: @vitejs/plugin-react, host:true, port 5173, /api proxy to :3001
- `packages/frontend/index.html` - Standard Vite HTML entry with lang="en", title, #root div, module script
- `packages/frontend/src/main.tsx` - createRoot render of App into #root, imports global.css
- `packages/frontend/src/styles/tokens.css` - 40+ CSS custom properties: bg layers, borders, text, green accents, semantic, typography, spacing, transitions
- `packages/frontend/src/styles/global.css` - Box-sizing reset, dark body/html (100% height), #root flex-column, dark scrollbars, subtle focus-visible ring
- `packages/frontend/src/App.tsx` - Root component with useState activeTab, single 'subtitles' tab, renders Header + main with SubtitlesPage
- `packages/frontend/src/App.css` - Full-height flex column layout, scrollable overflow:auto main
- `packages/frontend/src/components/Header.tsx` - 48px fixed header: "Eigen Video Editor" left, TabNav right
- `packages/frontend/src/components/Header.css` - flex space-between, --color-bg-elevated, --color-border bottom
- `packages/frontend/src/components/TabNav.tsx` - Button-based tab nav with aria-selected, onTabChange callback
- `packages/frontend/src/components/TabNav.css` - --color-accent-green border-bottom on active, secondary text inactive with hover
- `packages/frontend/src/pages/SubtitlesPage.tsx` - Centered "Drop a video or click to upload" placeholder (Plan 04 will replace with UploadZone)
- `packages/frontend/src/pages/SubtitlesPage.css` - flex:1 + align/justify center for full-height centering

## Decisions Made

- Dark mode is the only mode — no color scheme toggle; dark styles are applied directly to :root and body without class switching
- Co-located .css files per component (not CSS modules, not styled-components) — keeps tooling minimal and readable
- Single Subtitles tab only — no placeholder/coming-soon slots per user decision
- global.css uses @import './tokens.css' to enforce token-first load order independent of JS import sequence

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Frontend shell is complete and ready for Plan 04 (backend upload endpoint + UploadZone wiring)
- SubtitlesPage placeholder is the integration point — Plan 04 replaces its inner content with the real UploadZone component
- All design tokens are in place for Plan 04+ UI components (dropzone uses --color-dropzone-* tokens already defined)
- Vite proxy to localhost:3001 is wired — backend API calls from the frontend will work once Plan 02/04 brings up the server

---
*Phase: 01-foundation*
*Completed: 2026-02-25*

## Self-Check: PASSED

All 14 expected files found. Both task commits verified in git log (da96b32, bda73a2).
