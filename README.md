# omanote

Web app, native Android/iOS app, and browser extension — all sharing one Convex backend.

## Product direction

- Canonical product requirements: [docs/prd.md](docs/prd.md)
- Implementation checklist: [docs/implementation-checklist.md](docs/implementation-checklist.md)
- Mobile app architecture and plan: [docs/mobile-app.md](docs/mobile-app.md)
- Motion and interaction notes: [docs/motion-memory.md](docs/motion-memory.md)
- Encryption and recovery guide: [docs/encryption.md](docs/encryption.md)
- Design system and dark mode spec: [docs/superpowers/specs/2026-05-09-design-system-dark-mode-design.md](docs/superpowers/specs/2026-05-09-design-system-dark-mode-design.md)

## What is included

- React + TypeScript + Tailwind web app scaffold
- Clerk auth wired into the UI
- Canvas, Todos, Notes, Bookmarks, Event, and Search screens
- SEO-ready public landing page positioned as a personal daily workspace
- Shared date and artifact utilities in `packages/shared`
- Convex backend wired for the current canvas-first product model
- Client-side end-to-end encryption with passphrase + recovery key unlock
- Native Android (and iOS) app in `apps/mobile/` — Expo SDK 56, React Native, full feature parity
- Browser extension in `extension/` — Chrome and Firefox

## Mobile app

The native Android/iOS app lives in [`apps/mobile/`](apps/mobile/). It shares the Convex backend with the web app and has full feature parity: Canvas, Todos, Notes, Bookmarks, Events, Search, Explore, Insights, and Settings.

- **Auth:** Clerk + Google OAuth via Android Custom Tabs (not a webview)
- **Crypto:** Same AES-GCM-256 / PBKDF2 encryption as the web app — blobs are cross-compatible
- **Biometric:** Passphrase can be saved to Android Keystore and unlocked with fingerprint/face
- **Push notifications:** Local scheduled notifications for todo reminders

See **[apps/mobile/README.md](apps/mobile/README.md)** for the full setup guide — Clerk configuration, local env, build commands, known issues, and project structure.

## Desktop app

The Windows/macOS/Linux app lives in [`apps/desktop/`](apps/desktop/) — a Tauri 2 native shell that loads the production site (same approach as the mobile app) with native OS notifications, single-instance behavior, and external links opening in the system browser. Installers are published publicly at https://github.com/thehumanx/omanote-releases/releases.

### Shipping updates — what do I do when I change omanote?

**Changed anything in the web app (`src/`, `convex/`, styles, features, fixes)?**
Just deploy as usual (push to `main` → Vercel). Installed desktop apps load the live site, so they pick the change up on next launch — no desktop build, nothing else to do. This covers ~95% of updates, including desktop-only behavior gated behind `isTauri()`.

**Changed the desktop shell itself (`apps/desktop/` — Rust code, Tauri config, icons)?**
Cut a desktop release:

1. Bump the version in three files: `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/package.json`.
2. Commit and push to `main`.
3. `git tag desktop-vX.Y.Z && git push origin desktop-vX.Y.Z`

CI builds Windows (.msi/.exe), macOS (universal .dmg), and Linux (.deb/.rpm/.AppImage) and publishes them to the releases repo automatically (~30 min). Needs the `RELEASES_TOKEN` repo secret (fine-grained PAT, Contents read/write on `omanote-releases`) — refresh it when it expires.
If GitHub Actions billing blocks the publish job, rerun only that job on a self-hosted runner or publish the downloaded artifacts manually with `gh release create`.

For a test build without publishing: `gh workflow run desktop-build.yml`, then `gh run download` the artifacts.

See **[apps/desktop/README.md](apps/desktop/README.md)** for prerequisites, local dev (`npm run desktop`), and architecture notes.

## Tech stack (tools, libraries, platforms)

- Frontend app: React 18, TypeScript, React Router, Tailwind CSS, Lucide icons, React DayPicker
- Editor/rich text: Tiptap (`@tiptap/react`, `starter-kit`, `extension-link`, `extension-placeholder`) + `tiptap-markdown`
- Backend/data: Convex
- Email/feedback delivery: Resend (via Convex action in `convex/feedback.ts`)
- Local-first storage: Dexie (`dexie`, `dexie-react-hooks`)
- Auth: Clerk (`@clerk/react`)
- RSS CORS proxy: Cloudflare Worker (`workers/rss-proxy/`)
- Parsing/utilities: `chrono-node` (natural language date parsing), `react-day-picker` (canvas date picker), `emojilib`
- Browser extension: separate `extension/` workspace in the same monorepo (React + Preact runtime, Chrome/Firefox extension APIs)
- Browser platform APIs: IndexedDB, BroadcastChannel, Web Locks API, Notifications API, Visual Viewport API
- Tooling/build: Vite, PostCSS, Autoprefixer, Tailwind Merge
- Testing: Vitest, Testing Library (`@testing-library/react`, `@testing-library/jest-dom`), JSDOM
- Docs tooling: `scripts/generate-docs-html.mjs` (`npm run docs:html`)

## Start here

1. Run `npm install`.
2. Add required environment variables in `.env.local`.
3. Run `npm run dev`.
4. Optional checks: `npm run typecheck`, `npm run build`, and `npm run docs:html`.

## Docs workflow

- Markdown files in `README.md` and `docs/` remain the source of truth.
- Run `npm run docs:html` to generate browser-friendly HTML docs in `docs/html/`.
- Open `docs/html/index.html` to browse the generated docs.

## Required env vars

- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_FRONTEND_API_URL`
- `VITE_RSS_PROXY_URL` — Cloudflare Worker URL for RSS feed fetching (e.g., `https://omanote-rss-proxy.iambishistha.workers.dev`)

## Current state

- An RSS reader is available as an optional feature — turn it on from Settings → Features. When enabled, a Read / Write toggle appears at the top to switch between the reader and the rest of the app.
- Subscribe to any RSS or Atom feed by pasting a URL. The app fetches and parses feeds client-side via a Cloudflare Worker CORS proxy — no server-side egress.
- Feeds are organized into categories with custom icons, just like bookmark categories. Each category row shows the icon, name, and feed count; individual feed rows show unread article counts as badges.
- Articles open in a full-height reader that slides in from the right. Save for later, push to bookmarks, or open the original — all from inside the reader.
- Saved articles appear in a card grid matching the bookmark gallery style — thumbnail on top, title and description in the body, and feed name at the bottom.
- Reader data syncs to your device locally so the feed list and articles load from cache without hitting the server on every visit.
- omanote is now available as a desktop app for Windows, Mac, and Linux — download it from the releases page (linked on the landing page). It's a real app: it opens to its own welcome screen, signs you in through your browser, shows todo reminders as real system notifications (even while the app is open), and its top bar sits flush with the window controls.
- The landing page has a Desktop app section with a download button next to the existing Browser extension section.
- Clerk sign-in is wired in the UI.
- Convex auth validation is configured from the Clerk Frontend API URL (`CLERK_FRONTEND_API_URL`).
- User content fields are encrypted client-side before Convex writes, so stored values are ciphertext.
- Encryption unlock persists for the active signed-in session (including reloads) and is cleared on sign-out.
- `/settings` now groups personalization into Look & feel, Notifications, Security, Devices, Data, and Account categories.
- Note editing shortcuts are now fixed and consistent: `Enter` for paragraph, `Shift+Enter` for line break, and `Cmd/Ctrl+Enter` to save.
- Recovery keys can be downloaded/rotated from Settings and used at unlock time if the passphrase is forgotten.
- Passphrases can be changed from Settings after verifying the current passphrase.
- All primary screens now share a unified `PageHeader` top chrome: greeting on the left, date navigation in the center (Canvas only), and a page-specific weekly stat on the right that links to Insights.
- Canvas shows a consecutive-day streak (🔥 N day) as its stat. Other pages show their own weekly count: todos done, notes written, bookmarks saved, events logged.
- Canvas date navigation is clickable: tapping/clicking the date opens a React DayPicker calendar. Picking a date jumps to that canvas, past dates are capped to the first date with local user data, and future dates are capped at today.
- On desktop, Canvas shows the full `← Today · May 25 →` date nav with chevrons; on mobile the date is shown without arrows to preserve space. Unavailable date navigation is visually muted.
- Mobile canvas and inline editors now use explicit icon-only save affordances where keyboard shortcut-only flows were not practical.
- Mobile canvas capture shows a focused-only icon pill above the draft input for switching note/todo/event/bookmark without opening slash commands; switching type keeps the text already entered. Saving a todo created through this switcher clears the copied note draft so it does not repeat below the new todo.
- Canvas mobile spacing now keeps a single 16px side gutter (no double horizontal padding).
- Todos, Notes, and Bookmarks pages are edge-to-edge on mobile — no horizontal gutters below tablet width.
- On mobile, the greeting shows only the time-of-day emoji and first name (e.g. ☀️ Bibek) to prevent truncation on small screens.
- Mobile keyboard handling now uses `visualViewport` state so focused editors stay visible with faster, non-smooth repositioning.
- Bottom nav tabs are icon-first on mobile, while desktop keeps text labels.
- On mobile, swiping the center bottom-nav tab pill pages between Canvas, Todos, Notes, Bookmarks, and Event with wrap-around; Explore and Profile stay outside that gesture.
- On mobile, the bottom nav now hides whenever the keyboard is open so editors and search inputs keep the full vertical room.
- Mobile search now docks to a top panel (input + results) and locks background scroll while open.
- The desktop profile menu now dismisses on outside click instead of requiring a second tap on the avatar.
- Profile menus now include an `Edit` action on both desktop and mobile, opening the account management page in a new tab (`https://accounts.omanote.iambishistha.com/user`).
- Hashtag autocomplete now anchors near the active typing caret/token and dynamically flips above or below based on available viewport space.
- Reminder timing is configurable (exactly on time or 5/10/15 minutes early).
- Reminder toasts use configurable default snooze and duration values from Settings.
- Delete toasts now appear at the top-center with subtle top-entry/top-exit animation and show a truncated preview of deleted content for quick confirmation + undo.
- Browser notifications fire via the Web Notifications API when enabled and permitted, but only when the tab is in the background — no system popups while the app is already visible.
- Past-due reminders now appear the moment the app loads, not after the first polling tick.
- If the app is open in multiple tabs, only one tab fires each reminder — cross-tab dedup is handled via `BroadcastChannel`.
- Snoozing a reminder while offline is now reliable: both snooze timing and reminder-fired state are queued in the outbox and replayed on reconnect.
- A dismissable permission banner prompts users to enable browser notifications on first load.
- Settings includes controls to enable/disable in-app and browser reminders, and to re-enable dismissed browser notification prompts.
- Data import/export has moved to Settings.
- Account deletion is available from Settings and removes Convex user data before deleting the auth account.
- The browser tab favicon gains a red count badge and the document title is prefixed with `(N)` while unread reminder toasts are active.
- Notes and Bookmarks now use adaptive workspaces: desktop keeps split panes with aligned top spacing + visible vertical dividers, while mobile uses list-first drill-in sheets with back headers.
- Notes and Bookmarks mobile detail drawers now open as full-width bottom sheets above both top chrome and bottom nav, with a full-screen dim backdrop.
- omanote now supports offline-first canvas work for notes, todos, bookmarks, and events with optimistic local rendering and background sync on reconnect.
- All user data is cached in a local IndexedDB store (Dexie) so the app loads instantly without waiting for the server. An incremental sync worker pulls only changed records from Convex in the background, advancing a per-table cursor so each sync fetches the minimum possible data.
- Sync runs automatically on unlock, every 5 minutes, and within 300 ms of any mutation. Only one tab syncs at a time (Web Locks API).
- Notes now have persisted folders, inline create/edit surfaces, folder sort controls, rename/delete actions, canvas-aware folder assignment, and persisted folder/list sorting + list/gallery view preferences.
- Bookmarks keep modal editing with category-first browsing, plus persisted category sort, bookmark sort, and category list/gallery view preferences.
- Bookmark URL input now accepts bare domains (`facebook.com`, `www.example.com`) — they are auto-normalized to `https://` before saving so link preview metadata is always fetched.
- Link preview pipeline (title, description, thumbnail, favicon) is hardened: correct entity decoding, reliable favicon selection, bot-challenge detection, reduced timeouts, and an in-memory cache to avoid redundant fetches.
- Todos, Notes, and Event now render inline attachment preview cards when they contain previewable URLs.
- Bookmarks "Saved" now includes linked artifact URLs auto-collected from notes/todos/events (deduped against existing saved bookmarks) with source references.
- Linked artifact bookmarks now show an always-visible "Saved in …" pill on the thumbnail and open a linked-artifacts sheet with note/todo/event icons plus artifact-specific metadata (todo due/completion details, note preview text, event time/provenance).
- Todos now use adaptive status/schedule navigation: desktop keeps a left rail, mobile uses a single-row top tab strip.
- The Later todo view sorts future todos nearest-first, while other todo views keep their existing ordering.
- Todos now support natural-language modal capture from the `+` action in the todo view.
- Todos now default missing due dates to today; when a time is parsed, that time is preserved.
- Legacy todos without due dates are automatically backfilled to today.
- Completed todos now mirror into Event as read-only timeline entries with a checkmark marker.
- The Event page now uses the shared segmented pill chrome for calendar and timeline switching so it matches the rest of the app shell.
- In-app update notices now aggregate missed releases: the banner shows latest plus `+ x more updates`, and the modal lists all unseen changelog entries.
- Hashtags are now fully supported across notes, todos, and events with:
  - Autocomplete picker that appears when typing `#`
  - Visual highlighting in edit mode (colored background behind hashtags)
  - Colored chip display in view mode (deterministic 10-color assignment)
  - Explore mode for hashtag-based discovery (force-directed graph visualization and mind map filtering)
- Canvas inline editors for todos and events now also show hashtag autocomplete while typing in todo title, event label, and event notes.
- Notes page list bullets now render correctly in preview mode (marker dots/numbers are preserved in list view cards).
- The public landing page now targets "opinionated daily workspace" and "personal daily workspace" positioning without presenting omanote as an AI note-taking app.
- Extension install links on the public landing page now point only to the official Chrome Web Store and Firefox Add-ons listings.
- Static SEO metadata now includes title, meta description, canonical URL, robots meta, Open Graph tags, Twitter card tags, and JSON-LD for `WebSite`, `SoftwareApplication`, and `FAQPage`.
- `/robots.txt` and `/sitemap.xml` are served from `public/` for the canonical domain `https://omanote.iambishistha.com/`.
- Authenticated app routes are lazy-loaded so public landing visitors do not download every app screen in the initial JavaScript chunk.
- The app has a full semantic design system: raw Tailwind color utilities are replaced by `app-*`, `action-*`, `danger-*`, `success-*`, `warning-*`, and `info-*` CSS variable–backed tokens across every authenticated screen.
- Three theme modes are supported — System, Light, and Dark — synced through Convex `userSettings` with a localStorage mirror for a flash-free first paint. The active mode is switched from the profile menu via an animated segmented pill.
- Public pages (landing, auth, shared-folder, privacy, updates) are always rendered in light mode regardless of the user's theme preference.
- Note folders and bookmark categories now support a custom icon — choose from 20 curated Lucide icons or any emoji using the icon picker. Icons are plaintext (not encrypted) so they render instantly without a decrypt round-trip.
- The icon picker includes a searchable emoji dropdown backed by emojilib (1,900+ emojis) with ranked results: exact keyword match → prefix match → contains match. Typing a bare name (e.g. `rocket`) resolves to the matching emoji without requiring `:shortcode:` syntax.
- The browser extension's folder and category selector is now a custom dropdown that displays each folder/category icon alongside its name.
- The mobile folder/category drawer always shows the folder icon in the header, including the default folder icon for uncustomised folders.
- The 3-dot action menu is removed from folder/category list rows on mobile — it is accessible only from the drawer header, eliminating the duplicate affordance.
- Renaming a folder or category from the mobile drawer no longer activates edit mode in the background list; the two surfaces are isolated by a `drawerRenaming` flag.
- Folder rename no longer bumps sort position in last-updated order — sort is seeded from `createdAt` and advances only on note/bookmark activity, not on folder metadata edits.
- Inline composer inputs (bookmark URL, note folder picker, canvas category selector) use a bottom-border-only naked style matching the todo/event field appearance; the full-border `<Input>` component is reserved for modal/form fields.
- All artifact icon containers (todo checkmark, event clock, bookmark) use a consistent 32 px outer wrapper with the visual centered inside, keeping input rows aligned across all canvas artifact types. The gap between the icon and text is 8 px across all artifact types.
- Canvas artifact rows sit flush with no visible padding in their default state; hovering reveals a rounded highlight that fills the padded area without shifting content.
- Category dropdowns in the canvas draft block and the note folder picker are rendered via `createPortal` to `document.body` with `position: fixed`, preventing clipping by the scroll container that `overflow-x: hidden` on the main element forces.
- Bottom nav shadow tightened so it no longer bleeds past the screen edge on mobile.
- You can now pick a font style in appearance settings — sans-serif for a clean modern look, or serif for a warmer reading feel. The choice applies across the whole app instantly.
- Buttons near the bottom of the Settings page that were previously unclickable now work correctly.
- A dedicated Insights screen shows a full picture of how you use omanote: completion rate, overdue rate, week-over-week deltas, content breakdown by artifact type, canvas density, per-habit sparklines, and a 365-day activity heatmap.
- Every stat on the Insights page shows a week-over-week badge so you can tell at a glance whether this week is up or down compared to last.
- Notes, todos, and bookmarks now track whether they were saved from the browser extension or the web app. The Insights screen shows this as a stacked bar chart broken down by artifact type.
- Appearance settings now include a dashboard stat pin — choose which weekly stat appears in the header (streak, todos done, notes written, bookmarks saved, events logged) or let it cycle automatically.
- The canvas page shows an optional dot grid background for a Miro-like feel. It can be toggled on or off from Settings → Look & feel → Canvas (on by default).
- Clicking a folder or category icon directly opens the icon picker — no need to go through Edit first. On mobile this only works in the drawer header, not in the list or gallery view.
- The icon picker popup always stays fully visible — it flips above the anchor when there isn't enough space below, and a focus ring shows which folder or category is being edited.
- The "Update your extension" and "Download extension" buttons detect your browser and link to the Firefox Add-ons page or Chrome Web Store accordingly.
- A Feedback button in the profile menu lets users send feedback or feature requests directly from the app. Messages are stored and delivered to the developer's inbox via email. Users can choose to submit anonymously or share their email for follow-up.

## Changelog voice

Write changelog entries for normal users, not for the person who built the thing. Keep the tone casual, witty, and clear:

- Say what changed in everyday language and why the user should care.
- Avoid internal implementation names, acronyms, stack details, and bug-message archaeology unless the user would recognize the symptom.
- Prefer "the save popup now opens the first time" over "content script reinjection now wraps classic IIFEs".
- Keep jokes light and useful. Funny is seasoning, not the whole meal.

## Offline behavior (technical)

- All data is stored in a local Dexie/IndexedDB database (`omanote`). The app reads from this cache first; the server is only contacted by the background sync worker.
- The sync worker runs `listUpdatedAfter` queries on each table, paging in batches of 500 and advancing a per-table cursor stored in `syncCursors`. Safe to retry — each table advances independently.
- Sync is gated on both Convex auth (`isAuthenticated`) and the encryption unlock (`!isLocked`) to prevent unauthorized queries on startup.
- Only one tab runs the sync worker at a time via `navigator.locks.request("omanote-sync", { ifAvailable: true })`.
- After any mutation, `scheduleSync()` fires a 300 ms debounced sync pass to pull the result into Dexie promptly.
- Offline canvas mutations are persisted in `localStorage` (`omanote.canvas-outbox`) and flushed on app boot plus every `online` event. After flush, a sync pass runs to pull all replayed changes into Dexie.
- Outbox entries are retried up to 5 times and discarded when older than 7 days.
- Notes, bookmarks, and event entries use `clientKey` idempotency to prevent duplicate creates after reconnect.
- Unsynced canvas artifacts render a crossed-wifi status icon (`pendingSync`) only while the mutation is in flight. The icon clears as soon as Convex confirms the write.
- The app shell shows an offline status banner while disconnected, then displays a reconnect toast before catch-up sync starts.
- When the signed-in user changes, all Dexie tables are cleared before the new user's data syncs, preventing cross-user data exposure.

## Versions

### v0.22.3 [June 17, 2026]

> RSS feeds now fetch client-side — zero server egress. Feeds only refresh when you open them.

- [Add] RSS feeds now fetch client-side via a Cloudflare Worker CORS proxy — zero Convex data egress.
- [Add] Feeds only refresh when you open them — no background cron job.
- [Add] Cloudflare Worker CORS proxy at `omanote-rss-proxy.iambishistha.workers.dev`.
- [Update] Removed server-side RSS cron job and related Convex actions.

### v0.22.2 [June 15, 2026]

> Small tuneups, cleaner canvas inputs, and a much calmer backend. Free accounts still come with a price tag somewhere.

- [Fix] The todos and events input field takes the same width as notes in canvas.
- [Fix] RSS background sync now skips entirely unless the reader is enabled or you're on /reader, and full article content loads only when you open an article.
- [Fix] Background fetching now has tighter limits, reducing unnecessary database hits while keeping the app fresh.

### v0.22.1 [June 14, 2026]

> Calendar jumps, calmer Later todos, and a small mobile capture cleanup.

- [Add] The Canvas date label now opens a calendar picker. It can jump to any canvas from your first data date through today, without wandering into empty future days.
- [Update] Later todos are now sorted nearest-first, so the next thing coming up sits at the top.
- [Fix] Saving a todo from the mobile canvas switcher no longer leaves the same text behind in the note composer.

### v0.22.0 [June 11, 2026]

> The RSS reader is here. Subscribe to feeds, read in-app, and save articles to your bookmarks — all opt-in from Settings. And some fixes.

- [Add] RSS reader is now a feature you can turn on from Settings → Features. Off by default, so, no change for anyone who doesn't want it. When the RSS reader is on, a Read / Write toggle appears at the top to switch modes.
- [Add] Subscribe to any RSS or Atom feed by pasting a URL. The app fetches and parses the feed server-side and keeps it fresh automatically.
- [Add] Organize feeds into categories with custom icons, just like bookmark categories.
- [Add] Read articles in-app. Save for later or push straight to your bookmarks — all from inside the reader.
- [Fix] The app now recognizes your desktop app and renders properly on Devices page.
- [Fix] Replaced hardcoded error messages to read human-like throughout omanote.
- [Fix] Adding a site that hides its feed (like Medium publications) now works — omanote checks the usual feed spots instead of giving up.
- [Add] Feed looking empty? Hit "Fetch now" to pull the latest articles right away instead of waiting for the next auto-refresh.
- [Fix] The reader now greets you the same way as the rest of the app — one greeting, everywhere.

### v0.21.1 [June 10, 2026]

> Minor fixes here and there.

- [Fix] Images not loading on publicly shared page is not fixed

### v0.21.0 [June 9, 2026]

> New font, bug fixes and better notifications! And a founder's note.

- [Update] Ever tried serif font on omanote? Aleo replaces Literata. Now you might wanna switch you default font font to Lato to Aleo. Just head over to the Settings > Look & feel to change.
- [Fix] Adding todo on mobile was being duplicated in the input box below. Fixed that.
- [Add] Add much variations for the greetings. Now you're gonna love 'em even more. Send feedback, i'd love to hear your thoughts on this and others! Go to profile option > Send feedback to send something my way.
- [Update] Notifications are not timely delivered even when you close your tab. If you don't, send feedback please.
- [Add] A nice little founder's note to read why I built the app.


### v0.20.4 [June 8, 2026]

> Just some UI cleanups.

- [Remove] Plus button to add note and sorting is removed from note page. Just add the note from bottom of your page and all the notes are sorted by latest at the bottom by default. Also, folder selection dropdown is not hidden during note addition in notes page. Why choose the folder again when you are already inside a folder?
- [Add] Created and last updated date + total links/hashtags now shows up on top of each folder contents.

### v0.20.3 [June 2, 2026]

> Minor fixes for mobile view and linkpaste on canvas

- [Fix] Artifact switcher toolbar instead of rich text for mobile view.
- [Fix] New library had disabled "paste link to bookmark". Now it's back.

### v0.20.2 [May 29, 2026]

> Interaction polish on mobile drawers, timeline spacing, and create-mode hashtags.

- [Fix] Mobile profile drawer backdrop no longer clicks through to artifacts behind it when dismissing.
- [Update] Event timeline spacing tightened (date-dot gap and event-row alignment) for a cleaner left rail.
- [Fix] Hashtag autocomplete now appears while creating new todos and new events (not only while editing).
- [Update] Hashtags typed in new todo/event rows now show the same inline color highlight effect as other editors.
- [Fix] Removed duplicate Tiptap `link` extension registration warning by registering `link` only once in note editors.
- [Update] Settings page redesign to look cleaner and clearer
- [Update] Filter pills on insights page now appears at the bottom for consistency and ease of use
- [Update] Profile options reorganized + fixed delay in light/dark mode switch

### v0.20.1 [May 29, 2026]

> Small polish release: hashtags autocomplete where you type them, and note bullets are visible again.

- [Fix] Canvas todo title and canvas event label/notes now support hashtag autocomplete dropdown while typing `#`.
- [Fix] Notes page list cards now render bullet/number markers correctly in preview mode.

### v0.20.0 [May 29, 2026]

> Major fixes/enhancements on the richtext with a new Tiptap library and your profile edit is here.

- [Update] The text rendering now uses Tiptap library with live richtext, link preview and points. everythings is now nicely rendered both on view and typing mode.
- [Update] Reworked on how things are saved. Enter -> new paragraph, Shift + Enter -> new line, Ctrl/Cmd + Enter (or click outside) -> save. 
- [Remove] Keybinding settings are now no longer needed.
- [Fix] Link edit isn't a hassle anymore -- just tap the linked text to edit your links.
- [Update] The delete toast message now appears at the top center and the delay for the deletion is removed.
- [Update] Today's canvas shows "Today" instead of the date on mobile view.
- [Add] Want to change your name and avatar? Click the edit button beside your email. You'll be all set.
- [Fix] Adding hashtags now shows existing ones to select from as a dropdown.


### v0.19.0 [May 28, 2026]

> Canvas rendering redesign -- smth you don't need to understand but probably care as it fixes the scrolling issue of artifacts

- [Fix] Editing or adding the exiting long paragraph at the canvas end does not scroll the page now.
- [Fix] Click anywhere, the cursor stays there. Previously it used to stay at the bottom. Still facing some issue. Send me feedback: Profile menu > Send Feedback

### v0.18.2 [May 27, 2026]

> Long paragraph edit will now stop acting weird

- [Fix] Editing or adding the exiting long paragraph does not snap to the bottom.
- [Fix] The folder dropdown now respects the available space when appearing.

### v0.18.1 [May 27, 2026]

> Small ui fixes under the hood just to prove the point: You don't notice the good design.

- [Fix] The delete icon now do not stick to the right on canvas. A nice little padding added.
- [Update] Tightened the unnecessary spacing/padding that felt weird
- [Fix] Some ui issues on inputs and artifacts fixed
- [Update] The greetings on mobile just shows the emoji and name now due to spacing issue
- [Update] Decreased the gap between the nabar items so it feels tight


### v0.18.0 [May 26, 2026]

> Dot grid for canvas if you want to. Icon change got easier. And now you can share feedback or feature request right from the app!

- [Add] Dot grid view added for canvas. Don't like it? Turn it off from the settings.
- [Update] You can now edit your folder icon by just clicking on the icon.
- [Fix] Update extension button now recognizes your browser and takes you to its relevant page.
- [Add] Got something to day? There's a neat little button on your profile menu to send feedback right to my inbox. Please keep it sane. :P


### v0.17.0 [May 25, 2026]

> Your workspace now tells you how it's going. The new Insights page breaks down everything — productivity, content, and every day across the year. Plus the header redesign to show just the stat you need. Greetings? New serif font? bug fixes? this update feels like a whole app redesign.

- [Update] Unified header across all screens: greeting, date navigation (canvas), and a page-specific weekly stat replacing the old per-page title.
- [Add] New Insights page with three sections: Productivity (completion rate, overdue rate, week-over-week deltas, peak day/hour), Content (breakdown by type, extension vs web save chart, canvas density, top hashtags), and Activity (365-day heatmap).
- [Add] Canvas now shows a daily streak (🔥 N day) — consecutive days you've had something on the canvas.
- [Add] Per-page weekly stats: todos done, notes written, bookmarks saved, events logged. All link to Insights.
- [Update] App max-width reduced to 1152 px for a tighter, more readable layout.
- [Fix] Bookmark data persists your reload or sessions now.
- [Fix] Pin in/out to zoom in/out on the Explore page
- [Fix] Folder rename got easier -- you dont need to hit enter anywhere.

### v0.16.2 [May 20, 2026]

> Open tabs now notice when a new version is deployed — a banner appears automatically so you never miss an update.

- [Fix] Live update detection:new update? get the notification without having to reload the page.

### v0.16.1 [May 20, 2026]

> Folder drawer polish: icons always show up, the 3-dot menu stops duplicating itself on mobile, and renaming a folder no longer shuffles your sort order.

- [Fix] Mobile folder/category drawer cleaned up: icon always shows in the header, and the 3-dot menu is gone from the list rows — it was already there in the drawer.
- [Fix] Renaming a folder or category from the drawer no longer bleeds into the background list, and no longer shuffles your sort order — only actual note and bookmark activity counts.
- [Fix] Canvas composer inputs (bookmark URL, folder picker, category) now match the naked bottom-border style used by todo and event fields; icon containers are the same size across all three artifact types so nothing feels off-kilter.
- [Fix] Category and folder dropdowns no longer get clipped by the scroll container; bottom nav shadow tightened so it stops bleeding past the screen edge on mobile.

### v0.16.0 [May 19, 2026]

> Folders have a face now. Pick an icon for any note folder or bookmark category and it follows you everywhere.

- [Add] Custom icons for note folders and bookmark categories — 20 Lucide icons or any emoji.
- [Add] Live emoji search in the picker — 1,900+ emojis, just type the name.
- [Update] Extension folder and category selector now shows icons.
- [Update] Landing page mockups updated with folder and category icons.

### v0.15.4 [May 19, 2026]

> Reminders got a reliability tune-up — faster, multi-tab safe, and no longer noisy when you're already in the app.

- [Fix] Past-due reminders fire the moment you open the app, not after the first tick.
- [Fix] Two open tabs no longer double-fire the same reminder.
- [Fix] Browser notifications only appear when the app tab is in the background.
- [Fix] Snoozing while offline now sticks when you reconnect.

### v0.15.3 [May 16, 2026]

> Aleo as a secondary font for landing page

- [Add] Added the app serif font as a header font for the landing page.


### v0.15.2 [May 15, 2026]

> Small release, big polish: design system updates, and artifact switcher pill for mobile so you no longer need to type /.

- [Fix] Design system updates for buttons, pills, switch.
- [Fix] On mobile, the bottom navigation hides while the keyboard is open so it stops crowding editors and inputs.
- [Update] Canvas mobile capture now offers a focused-only note/todo/event/bookmark pill above the input, so switching artifact type no longer depends on typing `/`.
- [Fix] The desktop profile menu now closes when you click outside it, instead of hanging around like it owns the place.
- [Remove] Removed github extension link from landing page.

### v0.15.1 [May 12, 2026]

> The app's functional already -- its time for the aesthetic upgrade

- [Update] System rebuilt upon on the new design system spanning components and other primitives.
- [Update] Aesthetic revamp for checkbox, buttons and radios in place; others WIP.
- [Add] Current configuration indicator and reset option added on settings page.


### v0.14.1 [May 11, 2026]

> A tidy-up release: Settings got less cramped, tiny labels learned their manners, and the docs stopped pretending retired screens still worked here.

- [Update] Settings now has cleaner spacing, with the side menu and details lining up like they talked before the meeting.
- [Update] Small labels are more consistent: badges are for quick status/counts, chips are for tag-like bits you may want to click.
- [Update] The app notes and guides now match how omanote actually works today.
- [Fix] Removed old references to screens and controls that no longer exist, because haunted documentation helps nobody.

### v0.14.0 [May 10, 2026]

> Dark mode is here — and so is the full design system underneath it.

- [Add] System / Light / Dark theme preference, synced across devices. Extensions pending.
- [Update] Public pages (landing, auth, shared folders, privacy) are always light — dark mode is for the app only.
- [Add] Added the icons for navbar on desktop. Hate how it looks? configure them on the settings page. 

### v0.13.1 [May 9, 2026]

> Sharable notes folder and timeline view are here.

- [Add] You can now share your notes folder to anyone like your bookmark folder. 
- [Add] You can view all of your events as a timeline in the events page
- [Update] Linked urls are now shown below of the notes.
- [Update] The background of the navbar is white for better visibility on dark background.

### v0.12.9 [May 9, 2026]

> One grave mistake fixed: Your recovery key login will reset your passphrase. And dark mode is coming.

- [Fix] You will be asked to set up a new passphrase when you sign in with recovery key
- [Add] Ground works for dark mode, tokenization and design system in progress.

### v0.12.8 [May 8, 2026]

> Some bug fixes and improvements of element rendering and data fetching

- [Fix] Updated the rendering engine of tabs to dynamically resize based on content.
- [Fix] Fixed data fetching algorithm of app to fetch data saved from extensions instantly.
- [Update] Profile options on mobile appears as a drawer now instead of a popup.
- [Remove] Extensions link is hidden on mobile as extensions are desktop browsers only.
- [Fix] Close button is back on /settings page lol
- [Update] Completing your todos should now feel instant

### v0.12.7 [May 7, 2026]

> Your data now lives on your device first — the app loads instantly and stays snappy no matter your connection.

- [Update] The app now reads your notes, todos, bookmarks, and events from your device instead of waiting for the server each time you open it.
- [Fix] Saving an artifact no longer briefly flashes the offline icon — it only appears when you're actually offline.
- [Fix] Changes (edits, deletes, restores) now show up in the app right away instead of taking up to 5 minutes to reflect.

### v0.12.6 [May 7, 2026]

> All about extension

- [Update] Extension v2 is here redesigned and repacked with features.
- [Update] Updates are now on /updates as well and shows changelogs for both the webapp and extension.

### v0.12.5 [May 5, 2026]

> Some improvements under the hood

- [Update] Shared link preview now shows folder details instead of generic omanote metadata
- [Fix] Fixed some Convex bugs when checking off todos
- [Add] Deleted artifacts are now deleted forever. Added an undo button just in case you changed your mind right there.


### v0.12.4 [May 4, 2026]

> Some quality of life improvements you won't even notice.

- [Add] Completed todos are now in past tense for events, did it ever bother you? "Go to gym" -> "Went to gym"
- [Update] Some UI improvements for folder, changelogs and settings -- gallery view only for mobile layout, accordion for past changelogs and dropdow -> selectable pill for settings
- [Fix] Removed "on" preposition when adding todos in natural language. Previous: "Complete thesis on Monday" -> "Complete thesis on", Now: "Complete thesis" -- just a little bug I should've fixed earlier



### v0.12.3 [May 4, 2026]

> Remotely signout of your devices from right where you are from the redesigned settings page. 

- [Update] Redesigned the settings page for better organization
- [Add] Option to remotely remove your logged in devices.
- [Fix] Shared bookmark folder now shows total count, last updated date and is reflected on the page title
- [Update] Gallery/list view toggle for folders and categories is now mobile-only; desktop always uses list view.
- [Update] Gallery card layout updated — folder name, public icon, and count now appear in a single row beneath the folder icon.
- [Update] Shared bookmark category icon changed to a globe (public) icon across list view, gallery view, and mobile drawer.


### v0.12.2 [May 3, 2026]

> You don't notice the bugs unless you use them: Fixing bookmark bugs. 

- [Update] Mobile drawer now renders context menu on the header
- [Fix] Bookmarks folder were being duplicated for some reason, fixed it.
- [Fix] Shared folder now shows last updated date instead of shared date.
- [Fix] Pasting link on mobile now automatically detects a bookmark artifact
- [Fix] Optimized the codebase for better security and performance
- [Fix] UI improvements on todos, bookmarks and many more.

### v0.12.1 [May 2, 2026]

> Bookmark folder share is finally here! Now you can publicly share your bookmark collection to anyone you wish. 

- [Add] Option to share/unshare bookmark folder publicly. 
- [Update] Redesigned bookmark and note drawer tos how context menu

### v0.11.1 [May 2, 2026]

> Extensions are here! Now you can save from wherever you are to your omanote workspace. Plus, you can view your logged in device on your setting page now.

- [Add] New extensions for Firefox and Chromium based browsers are available in their official stores.
- [Add] Loggedin device are now shown on your Settings page.
- [Fix] Few fixes under the hood.


### v0.10.4 [April 30, 2026]

> Explore got a new upgrade, Routines are now Events and some underthehood changes.

- [Update] Explore page is redesigned and linked artifacts for hashtags are now shown in the sidesheet/drawer for clear view.
- [Update] Routines are now called Events because that's what they are
- [Fix] Janky animation when changing pages is now gone for good.
- [Fix] Deleted hashtags now do not show up on the explore page
- [Update] Swipe gesture for todos are now wrapped in mobile view.
- [Update] Landing page update on content.

### v0.10.3 [April 29, 2026]

> omanote is now SEO-optimized. The public landing page now explains omanote as a personal daily workspace, with search metadata and crawl paths in place. Plus few improvements under the hood.

- [Update] Refreshed the landing page around personal daily workspace positioning and reduced the initial public-page bundle with lazy-loaded app routes.
- [Add] Added SEO metadata, structured data, `/robots.txt`, `/sitemap.xml`, and regression coverage for the canonical omanote domain.
- [Add] Subtle animation when completing the todos
- [Fix] Keyboard doesnot open by default when opening /explore page on mobile.
- [Fix] If you have enter set as your save keybinding, the enter on mobile still works to insert a new line.

### v0.10.2 [April 28, 2026]

> Performance improvements and mobile optimzations for swipe gesture

- [Fix] Fixed performance issue due to redundant interval restarts and unnecessary offline queue flushes on every background sync
- [Add] Navbar on mobile are now swipeable to change the page.

### v0.10.1 [April 28, 2026]

> omanote now works even when your internet doesn't. Keep capturing, keep editing, and everything catches up when you're back online.

- [Add] Offline capture and editing across notes, todos, bookmarks, and event entries.
- [Add] Clear offline feedback in canvas with unsynced indicators and a persistent offline status banner.
- [Add] Automatic reconnect sync so pending changes upload in the background.

### v0.9.5 [April 28, 2026]

> Much needed enhancement for bookmarks. Your saved links now show previews and are kept in your bookmarks too. And a little housekeeping for todos and updates.

- [Add] Linked artifacts now show the thumbnail preview and kept under "Saved" on /bookmarks linked to their respective artifact.
- [Fix] Todos and completed date now appears side by side on desktop with a consistent icon 
- [Add] Button to add todos in "Today" empty state view
- [Remove] Outlined box from empty state
- [Add] Came back and missed 6 updates? The update popup now shows all the new updates you've missed since your last login.
- [Fix] All the pages now take full height. Previously it was clipped to the navbar.


### v0.9.4 [April 24, 2026]

> Your very own Settings page has arrived, and a refreshed landing page! Tweak notifications, customize keyboard shortcuts, lock things down with a new passphrase, and yes — you can now delete your account if you dare. Full control, finally in one spot.

- [Add] A brand new setting page that houses customizations and configurations
- [Add] Notification: Reminder, snooze and duration configuration
- [Add] Key bindings: Shortcut for saving/new line configuration
- [Add] Security: Change your passphrase
- [Update] Moved export/import and download recovery into /settings page
- [Add] Account: Account can now be deleted
- [Update] Emails are now astericked
- [Add] In-app notification for new updates
- [Update] Refreshed landing page -- signout to experience


### v0.9.3 [April 23, 2026]

> Bug-squashing bonanza! Editing todos is smoother, drawers can now be dragged closed like a pro, and bookmark categories are yours to manage. Plus a handful of small fixes that make the whole thing feel tighter.

- [Fix] Editing multi-line todos now works without issue
- [Update] Todos are now sorted reverse-chronologically in /todos
- [Update] "Upcoming" renamed to "Later"
- [Fix] Completed date now appears below the todo in mobile view
- [Fix] Editing notes folder in /notes page is working now
- [Add] Bookmark categories are now edit/delet-able. Saved bookmarks are defaulted to "Saved" category
- [Add] Drawer are now click-and-draggable to close on mobile view
- [Fix] Menu clipped on the right now fixed for gallery view
- [Fix] Swipe disabled when keyboard is open for mobile view
- [Add] Close icon for mobile view while editing/adding artifact



### v0.9.2 [April 21, 2026]

> Swipe everything! Move between canvas days with a flick, browse notes and bookmarks in gallery view, and pull your data in or out any time. A big visual and capability upgrade across the board.

- [Add] Swipe to change the canvas for mobile mode
- [Add] Now you can export and import your omanote data
- [Update] Swipe to change todos view -- ui update as well
- [Add] List/gallery view for notes and bookmarks
- [Add] Drawer for notes and bookmarks details
- [Update] Notes and Bookmarks drawers now open as full-width bottom sheets above top and bottom chrome with full-screen background dim.
- [Update] Notes now default to latest-first ordering (by last update), and Notes/Bookmarks persist view + sort preferences across navigation.



### v0.9.1 [April 18, 2026]

> Tiny fixes, big consistency. Dates and hashtags now play nicely everywhere — including the mind map. Nothing dramatic, just a whole lot more reliable.

- [Fix] Date time format is now consistent across the application
- [Fix] Hashtags added in todos and event now appears on /explore mindmap as well
- [Update] Date/time hidden from same date's canvas and "today" view of /todos

### v0.9 [April 17, 2026]

> The updates page is born! Now you can see what's new right inside the app — no digging around. Changelog and roadmap, right from the profile menu.

- [Add] Changelog & roadmap page is now available from the profile menu.
- [Add] Version label now appears on the updates page header and footer.
- [Update] Updates page copy is now fully user-facing and less technical.
- [Update] Bottom chrome on updates is simplified with a close `X` in the profile slot.
- [Update] Hashtag mind-map tooltip flow is being actively improved.


### Upcoming

- OPML import/export for RSS feeds
- Article readability extraction
- More customizations

## Desktop Versions

### v0.22.3 [June 17, 2026]

> RSS feeds now fetch client-side — zero server egress. Feeds only refresh when you open them.

- [Add] RSS feeds now fetch client-side via a Cloudflare Worker CORS proxy — zero Convex data egress.
- [Add] Feeds only refresh when you open them — no background cron job.
- [Add] Cloudflare Worker CORS proxy at `omanote-rss-proxy.iambishistha.workers.dev`.
- [Update] Removed server-side RSS cron job and related Convex actions.

### v0.22.2 [June 15, 2026]

> The desktop app catches up with the latest webapp fixes.

- [Update] Desktop now bundles the latest canvas, date picker, changelog, and backend-load fixes from the webapp.
- [Fix] Canvas inputs line up more cleanly, so todos, events, and notes feel consistent in the desktop app too.
- [Fix] Background fetching is calmer now, reducing unnecessary load while keeping your workspace fresh.

### v0.22.1 [June 12, 2026]

> A small fix for appimage on Linux.

- [Fix] Linux appimage now bundles without the wayland package and uses the one on your machine. (issue detected: Omarchy)

### v0.22.0 [June 12, 2026]

> The desktop app grew up. It's a real app now — not a website in a window.

- [Add] The desktop app now ships with the app built in. It opens instantly to a proper welcome screen on first launch — no landing page, no browser feel.
- [Add] Signing in on desktop now happens in your browser: click Sign in, finish in the browser, and you're bounced right back into the app, signed in.
- [Add] The desktop app asks for its own notification permission and has its own notification toggle in Settings → Notifications. Reminders pop as real system notifications — even while the app is open.
- [Add] On Mac, the app's top bar now sits flush with the window controls — the Read/Write switch lives right up in the title bar. On Windows, the app draws its own minimize/maximize/close buttons in the same bar.
- [Add] The desktop app keeps itself fresh: when a new version is out, it offers a one-click "Update & restart" — no manual downloads.


### v0.21.0 [June 10, 2026]

> Desktop apps are here. Plus minor fixes here and there.

- [Add] Desktop apps are now live. Whether you are on Windows, MacOS or Linux, omanote installs standalone on your device. Download them for seamless experience.

## Extension Versions

### v2.3.2 [Jun 2, 2026]

> The extension got a site control layer and a little more backbone when folders are slow to load.

- [Add] Select-text bubble can now be disabled per site from the popup, while context-menu saves still work everywhere.
- [Add] Popup includes an active/inactive current-site status pill and a dedicated blocked-sites view for review and removal.
- [Fix] Folder loading now falls back to cached data when Convex is temporarily overloaded, so the save popup stays usable instead of going blank.

### v2.3.1 [May 26, 2026]

> Slight fixes and optimization.

- [Update] Codes updated to fix /insights bug on the webapp

### v2.3.0 [May 19, 2026]

> The folder picker finally looks like omanote. Icons show up right next to the folder name so you always know where you're saving.

- [Update] Folder and category dropdowns now show each item's icon — no more guessing which "Work" is which.

### v2.2.0 [May 11, 2026]

> The browser extension got a reliability bath. Saves open more consistently, website fonts stop dressing it up weirdly, and old tabs behave themselves after an update.

- [Fix] Clicking the selected-text save bubble now opens the save popup the first time, even after the extension was just updated or reloaded.
- [Fix] Right-click saves are more dependable on pages that did not already have the extension awake.
- [Fix] Old open tabs no longer throw scary extension errors after you reload or update the extension.
- [Fix] The extension cleans up after sign-in tabs better, so fewer invisible browser leftovers hang around.
- [Update] The extension now keeps its own font and styling, so a dramatic website can no longer make the save popup look like it joined a costume party.
- [Update] Popup colors, shadows, and spacing are more consistent across the extension.

### v2.1.0 [May 9, 2026]

> Bug fixes and polish: keyboard capture, smarter saves, and a delightful checkmark animation.

- [Fix] Typing in the extension popup or save modal no longer sends keystrokes to the underlying page on sites like Twitter, GitHub, and Facebook.
- [Fix] Passphrase (encryption key) now persists across browser restarts — you no longer need to re-enter it every time you open the browser.
- [Fix] Hashtags typed in the extension are now saved into the note content and correctly placed before the source URL link.
- [Fix] Removed the hashtag field from the bookmark save form — bookmarks don't support hashtags.
- [Update] The save overlay no longer dims the page — it now behaves like a lightweight popup.
- [Update] Switching from the save form to the saved confirmation now smoothly animates the height instead of jumping.
- [Add] Animated SVG checkmark on save: the circle draws first, then the tick strokes in — consistent across the popup, selected-text bubble, and context menu flows.

### v2.0.0 [May 7, 2026]

> The extension feels like omanote now, stays connected longer, and lets you save into the right folder faster.

- [Fix] Increased extension session expiry to Clerk's so that you don't have to connect every single hour
- [Update] Extension redesigned to make it feel and look like an actual omanote extension
- [Add] Ability to add folder right from the extension. The last used folder is auto selected by default.
- [Fix] Small omanote save helper to save selected text now consistently appears wherever you are. Previously it only appeared above the fold.

### v1.0.0 [May 2, 2026]

> The first omanote extension release brings quick capture to the browser so saving does not interrupt what you are doing.

- [Add] First version of omanote extension is here.
- [Add] Save links, notes, todos right from wherever you are. Connect your omanote account and you're good to go.

## Notes

- Dates are treated in the user local timezone.
- The code is structured so the shared domain package can be reused by a future mobile app.
