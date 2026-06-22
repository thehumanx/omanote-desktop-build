# omanote Browser Extension

> Status: Built — v2.3.1
> Target: Chrome/Chromium (MV3) + Firefox (MV3)

> **Working rule:** Do not assume any project-specific value (URLs, domains, API endpoints, config keys). Always check the codebase or `.env` files, or ask the user.

---

## 1. Overview

The omanote browser extension lets users capture content from any web page — selected text, links, and full pages — and save them directly into their omanote workspace without switching tabs.

Public-facing install links should point to the official browser listings only:
- Chrome/Chromium: Chrome Web Store
- Firefox: Firefox Add-ons

Repo or source links can still exist for development and contribution, but they should not be the primary install CTA on the public landing page.

| Layer | What it does |
|---|---|
| **Content Script** | Watches for text/link selections, injects the floating capture bubble and Shadow DOM save modal |
| **Auth Bridge Script** | Runs only on the omanote app's `/auth/extension` page — bridges the JWT from the web page to the background |
| **Popup** | Toolbar icon click → quick-capture panel with current-site active/inactive toggle, settings, and blocked-sites management |
| **Background Worker** | Holds auth state, talks to Convex via HTTP, manages context menus |

---

## 2. Feature Set

### 2.1 Selection Bubble (Grammarly-style)

When the user selects text on an unblocked page, a small omanote bubble appears near the selection. Clicking it opens an inline save modal.

- Selected **text** → defaults to **Note**
- Selected text that is a pure URL → defaults to **Bookmark**
- Selected text + page URL → **Note with source link** (checkbox to include URL)
- Users can suppress the bubble for a site from the popup's current-tab status pill.
- Blocked sites are stored by normalized origin (`http://` / `https://`) and shown in a dedicated settings view.
- Right-click context menu saves still work on blocked sites; the block only suppresses the floating selection bubble.

The bubble disappears on click-away or Escape. It lives inside a **closed Shadow DOM** so page styles cannot interfere.

### 2.2 Context Menu (Right-click)

Four submenus injected into the browser's native context menu:

```
Right-click on selected text:
  └── Save to omanote
        ├── Save as Note
        └── Save as Todo

Right-click on a link:
  └── Save to omanote
        ├── Save as Bookmark
        └── Save as Note (with link)

Right-click on an image:
  └── Save to omanote
        └── Save as Bookmark (image URL)

Right-click anywhere (no selection):
  └── Save to omanote
        └── Save Page as Bookmark
```

### 2.3 Toolbar Popup

Clicking the extension icon opens a 360px React panel with:

- Type tabs: **Note / Bookmark / Todo**
- Form fields: content/URL, folder/category dropdown, hashtag input, source URL checkbox
- Folder and category dropdowns are custom (not native `<select>`) and show each item's icon alongside its name, matching the icon set from the main app
- A current-tab status pill at the top right that shows whether the selection bubble is active on the current site, and lets the user toggle that state
- A settings screen that includes account info, keyboard shortcut info, and a dedicated blocked-sites view for reviewing/removing sites
- Last 4 saved items (Recent section)
- Link to open the full omanote app

The popup and inline save modal use packaged Lato font files and extension-owned CSS variables so host pages cannot change the extension typography or color system.

### 2.4 Keyboard Shortcut

`Alt+Shift+O` (default, user-configurable in browser extension settings) opens the toolbar popup from any tab.

---

## 3. Authentication

omanote uses **Clerk** for auth and **Convex** for all backend operations. The extension does not bundle Clerk credentials; auth uses a **web-based handshake** with the production omanote site.

### 3.1 Auth Flow

```
1. User installs extension
2. Extension popup shows "Connect to omanote" screen
3. User clicks "Connect to omanote"
4. Extension background opens: https://omanote.iambishistha.com/auth/extension
   (new tab)
5. If not logged in → Clerk sign-in flow runs on that tab
6. After authentication, the page (ExtensionAuthScreen.tsx):
   a. Calls getToken({ template: "convex" }) to get Clerk JWT
   b. Sends it via window.postMessage({ type: "OMANOTE_EXT_AUTH", token, expiresAt, user })
   c. The auth-bridge content script (running on that page) forwards the message to
      chrome.runtime.sendMessage({ type: "AUTH_TOKEN_RECEIVED", ... })
7. Background worker stores token + user in chrome.storage.local
8. Popup updates to show "Connected as <name>" ✓
```

**Why `window.postMessage` instead of `chrome.runtime.sendMessage` from the page?**  
Firefox does not allow web pages to call `chrome.runtime.sendMessage` directly. The bridge content script pattern (`content/auth-bridge.ts`) works identically on both Chrome and Firefox.

### 3.2 Token Storage

Stored in `chrome.storage.local` under key `omanote_auth`:

```typescript
interface AuthState {
  token: string;
  expiresAt: number;
  user: { name: string; email: string };
}
```

The background worker refreshes the token automatically (via `chrome.alarms`) before it expires by re-opening the auth tab.

The auth bridge also has bounded listener cleanup: programmatic bridge injection listeners are removed after successful injection, tab close, navigation away from the auth URL, or a short timeout. This prevents repeated failed auth attempts from accumulating tab listeners.

### 3.3 Convex Client

The background service worker uses `ConvexHttpClient` — not the reactive WebSocket client — because service workers don't maintain persistent connections:

```typescript
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(CONVEX_URL);
client.setAuth(token);

await client.mutation(api.notes.createNote, { ... });
```

---

## 4. Architecture

### 4.1 File Structure

```
extension/
├── manifest.json               # Chrome/Chromium (MV3) — includes "type": "module"
├── manifest.firefox.json       # Firefox (MV3) — background.scripts variant
├── background/
│   ├── worker.ts               # Service worker entry
│   ├── convex-client.ts        # ConvexHttpClient singleton + save functions
│   ├── auth.ts                 # Token storage, refresh, openAuthTab
│   ├── context-menus.ts        # Right-click menu registration + handlers
│   └── message-handler.ts      # Routes all ExtMessage types
├── content/
│   ├── index.ts                # Content script entry
│   ├── selection-bubble.ts     # Shadow DOM bubble + save modal (vanilla TS)
│   ├── bubble-styles.ts        # CSS string injected into Shadow DOM
│   └── auth-bridge.ts          # Runs on /auth/extension — bridges postMessage → runtime
├── popup/
│   ├── index.html              # Toolbar popup shell
│   ├── main.tsx                # React entry
│   ├── Popup.tsx               # Main component
│   ├── popup.css               # Light theme stylesheet
│   └── components/
│       ├── AuthScreen.tsx
│       ├── SaveForm.tsx
│       ├── FolderSelect.tsx        # Custom icon-aware dropdown for folder/category selection
│       ├── RecentItems.tsx
│       └── SettingsView.tsx
├── save-modal/
│   ├── index.html              # Pre-save modal (loaded in iframe by content script)
│   └── main.tsx                # React entry
├── assets/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png            # Copied from main app's public/ folder
├── shared/
│   ├── types.ts                # AuthState, SavePayload, RecentItem, etc.
│   ├── messages.ts             # ExtMessage discriminated union
│   ├── storage.ts              # chrome.storage.local helpers
│   ├── colors.ts               # Shared extension color/shadow tokens
│   ├── color-vars.ts           # Installs CSS custom properties for extension pages
│   ├── folder-selection.ts     # Shared folder/category sorting and lookup helpers
│   └── date.ts                 # todayDateKey(), generateClientKey()
├── vite-env.d.ts               # /// <reference types="vite/client" />
├── tsconfig.json               # Extension source (excludes vite.config.ts)
├── tsconfig.node.json          # For vite.config.ts (node types)
├── vite.config.ts              # Multi-entry build + packageExtension plugin
├── postcss.config.cjs          # Empty — suppresses Tailwind warning in build
├── package.json
└── .env                        # VITE_CONVEX_URL
```

### 4.2 Build Output

```
dist/
├── chromium/                   # Load this as unpacked extension in Chrome
│   ├── manifest.json
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.js
│   │   └── popup.css
│   ├── save-modal/
│   │   ├── index.html
│   │   └── main.js
│   ├── content/
│   │   ├── index.js
│   │   └── auth-bridge.js
│   ├── background/
│   │   └── worker.js
│   ├── chunks/                 # Popup/background shared chunks
│   └── assets/
└── firefox/
    ├── manifest.json           # Firefox-specific background.scripts manifest
    ├── ...                     # Same structure as chromium/
    └── omanote.xpi             # Installable Firefox package
```

### 4.3 Manifests

Two manifests exist because Chrome and Firefox use different MV3 background declarations:

**`manifest.json`** (Chrome) — includes `"type": "module"`:
```json
"background": {
  "service_worker": "background/worker.js",
  "type": "module"
}
```

**`manifest.firefox.json`** (Firefox) — uses background scripts:
```json
"background": {
  "scripts": ["background/worker.js"],
  "type": "module"
}
```

The Vite build plugin copies the Firefox manifest over after mirroring the Chromium output.

### 4.4 Static Content Script Packaging

`content/index.js` must stay a classic static content script, not an ES module. Chrome and Firefox can load static content scripts from the manifest, and the background worker also reinjects `content/index.js` with `chrome.scripting.executeScript()` when a context-menu action fires on a page where the content script is not currently connected.

The Vite package step therefore:

1. Inlines the small shared chunks used by `content/index.js` (`folder-selection` and `colors`).
2. Removes top-level `import` / `export` from the built content script.
3. Wraps the built file in an IIFE so repeated programmatic injection cannot redeclare top-level globals.

`extension/content/content-build.test.ts` covers this packaging contract. If the content script ever ships with a top-level module import again, context-menu saves can fail with `Receiving end does not exist` because the injected script never registers its runtime message listener.

### 4.5 Message Protocol

All cross-context communication uses a typed discriminated union:

```typescript
// shared/messages.ts
export type ExtMessage =
  | { type: "OPEN_AUTH_TAB" }
  | { type: "AUTH_TOKEN_RECEIVED"; token: string; expiresAt: number; user: AuthState["user"] }
  | { type: "DISCONNECT" }
  | { type: "GET_AUTH_STATE" }
  | { type: "AUTH_STATE_RESPONSE"; auth: AuthState | null }
  | { type: "GET_FOLDERS" }
  | { type: "FOLDERS_RESPONSE"; data: FoldersData }
  | { type: "SAVE_ITEM"; payload: SavePayload }
  | { type: "SAVE_SUCCESS"; itemId: string; itemType: SavePayload["type"] }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "OPEN_SAVE_MODAL"; context: CaptureContext }
  | { type: "GET_RECENT_ITEMS" }
  | { type: "RECENT_ITEMS_RESPONSE"; items: RecentItem[] };
```

### 4.6 Content Script Reinjection and Stale Contexts

Open pages can outlive an extension reload. In that state, old content scripts may still receive page events, but calls such as `chrome.runtime.getURL()` or `chrome.runtime.sendMessage()` can throw `Extension context invalidated.`

The content script handles this by:

- detecting Chrome's `Extension context invalidated` error;
- removing its injected UI;
- cancelling pending selection timers;
- skipping further extension runtime calls from the stale script.
- stopping modal setup if rendering detects a stale context and removes the overlay.

On programmatic reinjection, `content/index.ts` replaces the previous open-modal message listener and refreshes selection listeners instead of permanently no-oping behind an "already loaded" flag. This lets context-menu saves reconnect after an extension reload without requiring the user to close the browser tab.

The modal setup path keeps a local reference to the active overlay before rendering. If stale-context cleanup removes that overlay, setup exits before attaching key/resize handlers. This prevents first-click crashes like `Cannot set properties of null (setting '_keyHandler')`.

---

## 5. Convex Integration

The extension background worker calls Convex directly via `ConvexHttpClient`. It shares the same `convex/_generated/api` types as the main app via the monorepo alias `@shared`.

Before saving user content, the extension must be unlocked with the user's encryption passphrase. The background worker unwraps the user's content key, stores the exported content key in extension storage, encrypts note/bookmark/todo fields locally, and only then calls Convex mutations.

### Save Note
```typescript
await client.mutation(api.notes.createNote, {
  body: encryptedContent,
  title: encryptedTitle,
  hashtags,
  folderId,
  folderName: encryptedFolderName,
  dateKey: todayDateKey(),
  clientKey: generateClientKey(),
});
```

### Save Bookmark
```typescript
// Fetch link preview first (non-fatal if it fails)
const preview = await client.action(api.actions.linkPreview.fetchLinkPreview, { url });

await client.mutation(api.bookmarks.createBookmark, {
  url: encryptedUrl,
  title: encryptedTitle,
  description: encryptedDescription,
  thumbnailUrl: encryptedThumbnailUrl,
  faviconUrl: encryptedFaviconUrl,
  siteName: encryptedSiteName,
  categoryId,
  createdDateKey: todayDateKey(),
  clientKey: generateClientKey(),
});
```

### Save Todo
```typescript
await client.mutation(api.todos.createTodo, {
  title: encryptedContent,
  createdDateKey: todayDateKey(),
  hashtags,
  clientKey: generateClientKey(),
});
```

### Load Folders & Categories
```typescript
const [folders, categories] = await Promise.all([
  client.query(api.notes.listNoteFolders),
  client.query(api.bookmarks.listBookmarkCategories),
]);
```

---

## 6. omanote App Changes

Two changes were made to the main app to support the extension:

### 6.1 `/auth/extension` Route

Added to `src/App.tsx` and implemented in `src/screens/auth/ExtensionAuthScreen.tsx`:

```typescript
const token = await getToken({ template: "convex" });
const expiresAt = Date.now() + 55 * 60 * 1000;
window.postMessage(
  { type: "OMANOTE_EXT_AUTH", token, expiresAt, user },
  window.location.origin
);
```

The auth-bridge content script (`content/auth-bridge.ts`) runs on this page, listens for the `postMessage`, and forwards it to the background worker via `chrome.runtime.sendMessage`.

### 6.2 Extension Auth Surface

`ExtensionAuthScreen.tsx` uses app design-system primitives and tokens rather than inline styles. It also surfaces a Firefox host-permissions hint when the auth page cannot see the bridge marker after a short delay.

### 6.3 No Other App Changes Required

The extension does not require any backend changes — it calls the same Convex mutations as the web app using the user's existing Clerk JWT.

---

## 7. Build & Development

### Commands

```bash
cd extension
npm run build   # Production build → dist/chromium/ + dist/firefox/omanote.xpi
npm run dev     # Watch mode (no XPI packaging)
npm run typecheck

# From the repo root:
npm test -- extension
```

### Loading in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `dist/chromium/`

### Loading in Firefox (development)

Firefox requires signed extensions for `about:addons`. For development:

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `dist/firefox/omanote.xpi` (or any file inside `dist/firefox/`)

The extension loads for the current browser session only — it is removed on browser restart during development.

### Environment Variables

```
VITE_CONVEX_URL=             # Your Convex deployment URL
```

---

## 8. Design System

The popup, save-modal iframe, selection bubble, and Shadow DOM modal use the same light theme as the omanote web app. Raw colors are centralized in `extension/shared/colors.ts`; extension pages install those values as CSS custom properties through `extension/shared/color-vars.ts`.

| Token | Value | Usage |
|---|---|---|
| `--accent` | `#5a8b16` | Buttons, active tabs, focus rings |
| `--accent-hover` | `#4a7212` | Button hover state |
| `--bg` | `#ffffff` | Main background |
| `--bg-subtle` | `#f4f4f5` (zinc-100) | Secondary surfaces |
| `--bg-input` | `#fafafa` | Form inputs |
| `--border` | `#e4e4e7` (zinc-200) | Borders |
| `--text` | `#18181b` (zinc-900) | Primary text |
| `--text-muted` | `#71717a` (zinc-500) | Secondary text |
| `--text-subtle` | `#a1a1aa` (zinc-400) | Placeholders, disabled |
| `--tab-shadow` | tokenized shadow | Segmented tab highlight depth |
| `--modal-shadow` | tokenized shadow | Floating save modal depth |

The popup uses `popup/popup.css`. The content script bubble and modal use `content/bubble-styles.ts` (a CSS string injected into Shadow DOM — no external stylesheet).

The content script defines its own `"OmanoteLato"` `@font-face` declarations and points them at packaged `assets/fonts/Lato-*.ttf` files. The Shadow DOM host and all descendants force that font stack so host-page fonts cannot leak into the bubble or modal.

---

## 9. Cross-Browser Compatibility

| Feature | Chrome | Firefox | Notes |
|---|---|---|---|
| MV3 | ✓ | ✓ (FF 109+) | |
| Service worker background | ✓ | ✗ | Firefox build uses `background.scripts` |
| Background module scripts | ✓ | ✓ | Separate manifest shape per browser |
| `chrome.*` namespace | ✓ | ✓ | Firefox aliases `browser.*` → `chrome.*` |
| `chrome.runtime.sendMessage` from web page | ✓ | ✗ | Use `window.postMessage` + content script bridge |
| `chrome.storage.session` | ✓ | ✗ | Extension uses `chrome.storage.local` only |
| Shadow DOM | ✓ | ✓ | |
| XPI install via `about:debugging` | — | ✓ | For dev; AMO signature required for `about:addons` |

---

## 10. Security

- **Token storage**: `chrome.storage.local` only — never `localStorage` (accessible to web pages)
- **Shadow DOM isolation**: The bubble and modal run in a closed Shadow DOM — the host page cannot access extension globals or stored tokens
- **Auth bridge scope**: `content/auth-bridge.ts` only matches `https://omanote.iambishistha.com/auth/extension*` — it does not run on any other page
- **postMessage origin checks**: The iframe save modal only accepts initialization messages from its embedding page origin and posts lifecycle messages back to that same origin
- **Runtime sender checks**: Background message handling rejects external extension senders and accepts same-extension / Firefox extension-page messages
- **No remote scripts**: All extension code is bundled at build time via Vite. No CDN-loaded scripts.
- **CSP**: Extension pages (popup, save-modal) set a strict CSP in their HTML, blocking inline scripts and external resources
- **Diagnostics**: Extension background/content failures log useful `[omanote]` diagnostics instead of being silently swallowed

---

## 11. Future Ideas

- **Page Clipper**: Right-click → "Clip full article" using Readability.js (Firefox Reader Mode engine) — saves clean article text as a long-form Note
- **Offline Queue**: If Convex save fails (offline), queue to `chrome.storage.local` and retry on next service worker activation
- **Badge Counter**: Show items saved today on the extension badge icon via `chrome.action.setBadgeText`
- **Omnibox Integration**: `omanote <text>` in the address bar opens the save modal pre-filled
