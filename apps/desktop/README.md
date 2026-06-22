# omanote desktop

Tauri 2 desktop app for Windows, macOS, and Linux. The web frontend is
**bundled inside the binary** (built from the repo root with
`.env.production`) and served from the `tauri://` origin — the app no longer
loads the production website. Signed-out users see a native onboarding
screen instead of the landing page.

## How sign-in works

Clerk's Google-OAuth flow cannot complete inside a desktop webview (WebKit
blocks the third-party cookies mid-flow), so sign-in happens in the system
browser with a deep-link handoff:

1. The onboarding screen opens
   `https://omanote.iambishistha.com/auth/desktop?state=<nonce>` in the
   default browser.
2. The user signs in there with the normal Clerk web flow.
3. The page calls the Convex action `desktopAuth.createSignInToken`, which
   mints a single-use Clerk sign-in token (Clerk Backend API, requires the
   `CLERK_SECRET_KEY` env var on the Convex deployment).
4. The browser redirects to `omanote://auth/callback?token=…&state=…`.
5. The app (tauri-plugin-deep-link) validates the state nonce and exchanges
   the token for a session via Clerk's `ticket` sign-in strategy.

### One-time configuration

- **Convex (prod + dev):** `npx convex env set CLERK_SECRET_KEY sk_… [--prod]`
- **Clerk:** the bundled app's origins must be in the instance's
  `allowed_origins`, or Clerk rejects frontend-API requests from the app:

  ```sh
  curl -X PATCH https://api.clerk.com/v1/instance \
    -H "Authorization: Bearer $CLERK_SECRET_KEY" \
    -H "Content-Type: application/json" \
    -d '{"allowed_origins": ["tauri://localhost", "http://tauri.localhost"]}'
  ```

  (`tauri://localhost` is macOS/Linux, `http://tauri.localhost` is Windows.
  Note this *replaces* the list — include any other origins you still need.)

### Dev caveats

- On macOS, custom URL schemes only resolve to **bundled** apps, so the full
  deep-link round-trip can't be tested with `tauri dev` — use
  `npm run desktop:build` and run the bundled .app. (In dev the browser flow
  itself still works against the Vite dev server.)
- macOS notifications may not appear for unbundled dev builds either.

## Window chrome

The web app's top bar doubles as the window title bar (`data-tauri-drag-region`):

- **macOS:** `TitleBarStyle::Overlay` + hidden title — the native traffic
  lights float over the app's top bar (the Write/Read pill row).
- **Windows:** no native decorations; the app renders its own
  minimize/maximize/close buttons (`WindowControls.tsx`).
- **Linux:** native decorations are kept (undecorated GTK windows lose
  resize borders).

## Auto-updates

On launch, installed apps check `latest.json` on the newest GitHub release
in omanote-releases (tauri-plugin-updater) and show an in-app
"Update & restart" banner when a newer version exists
(`DesktopUpdateBanner.tsx`). The CI publish job generates `latest.json`
pointing at the signed updater artifacts (`.app.tar.gz` for macOS, NSIS
`-setup.exe` for Windows, `.AppImage` for Linux).

Updates are signed with a minisign keypair: the public key lives in
`tauri.conf.json`, the private key in `~/.tauri/omanote-updater.key`
(no password) and in the `TAURI_SIGNING_PRIVATE_KEY` GitHub secret.
**Don't lose the private key** — apps in the wild only accept updates
signed with it. Dev builds skip the update check.

## Notifications

The desktop app requests its **own OS-level notification permission**
(tauri-plugin-notification) — it does not inherit the web app's browser
permission or synced browser-notification setting. The toggle lives in
Settings → Notifications ("Show system notifications from the desktop app")
and is stored locally on the device. Reminders are scheduled by
`ReminderMonitor` while the app runs and fire as native notifications even
when the window is focused. Web Push / service workers are not used in the
desktop shell.

## Prerequisites

- Node.js + npm
- Rust (stable) via [rustup](https://rustup.rs)
- Platform extras:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft C++ Build Tools + WebView2 (preinstalled on Win 10/11)
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`,
    `librsvg2-dev`, `build-essential` (Debian/Ubuntu names)

## Develop

From the repo root:

```sh
npm run desktop        # starts vite dev server + tauri window
```

In dev the window loads the Vite dev server (`.env.local`, i.e. the dev
Convex/Clerk instances).

## Build installers

From the repo root:

```sh
npm run desktop:build
```

This first builds the web frontend from the repo root (vite production
build, which reads the gitignored `.env.production`), then bundles it into
the installers under `apps/desktop/src-tauri/target/release/bundle/`:

- macOS: `.app` + `.dmg`
- Windows: `.msi` (WiX) + `.exe` (NSIS)
- Linux: `.deb`, `.rpm`, `.AppImage`

Each platform's installers must be built on that platform. CI does this:
`.github/workflows/desktop-build.yml` builds Windows, macOS (universal),
and Linux on every `gh workflow run desktop-build.yml` (artifacts only) —
and on every `desktop-v*` tag it also publishes the installers as a
GitHub Release on the public https://github.com/thehumanx/omanote-releases
repo. The build matrix stays on GitHub-hosted runners, but the `publish`
job runs on a self-hosted runner so a GitHub Actions billing block cannot
stop publication after the installers are already built. The release step
requires the `RELEASES_TOKEN` secret, a fine-grained PAT with Contents
read/write on that repo. CI also needs the
`DESKTOP_ENV_PRODUCTION` secret: the full contents of `.env.production`.

Release flow: bump the version in `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml`, and `package.json`, commit, then
`git tag desktop-vX.Y.Z && git push origin desktop-vX.Y.Z`.

Because the frontend is bundled, **frontend changes now reach desktop users
through a new desktop release**, not through website deploys.
