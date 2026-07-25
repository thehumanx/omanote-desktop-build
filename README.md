# omanote desktop

Build source for the [omanote](https://omanote.iambishistha.com) desktop app — a Tauri 2 native shell (Windows/macOS/Linux) that loads the production site with native OS notifications, single-instance behavior, and external links opening in the system browser.

This repo contains only the frontend and Tauri shell needed to produce that build. It is not the full omanote source — the Convex backend, mobile app, browser extension, and internal docs live in a private repo and are intentionally not published here.

Installers are published at [omanote-releases](https://github.com/thehumanx/omanote-releases/releases).

## Structure

- `src/`, `index.html`, `vite.config.ts` — the web frontend bundled into the desktop shell
- `convex/_generated/` — generated Convex API types (read-only client bindings; no backend logic)
- `convex/lib/` — a few pure helper modules imported by the frontend
- `packages/shared/` — date/recurrence/verb utilities shared with the frontend
- `apps/desktop/` — the Tauri 2 shell (Rust + config)
- `CHANGELOG.md` — shown in the app's "What's new" modal

## Local build

```bash
npm install
npm run build          # builds the web frontend to dist/
npm run desktop:build  # builds the native app via Tauri
```

Requires the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

## Releases

Pushing a `desktop-vX.Y.Z` tag triggers `.github/workflows/desktop-build.yml`, which builds installers for all three platforms and publishes them to [omanote-releases](https://github.com/thehumanx/omanote-releases).
