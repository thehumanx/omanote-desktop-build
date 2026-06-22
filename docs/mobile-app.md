# Omanote Mobile App

Last updated: 2026-06-02

## What this document covers

Architecture decisions, technology rationale, implementation phases, and remaining work for the native Android (and iOS) app at `apps/mobile/`.

For the setup and build guide, see [`apps/mobile/README.md`](../apps/mobile/README.md).

---

## Why a native app and not a webview wrapper

The previous attempt used Capacitor, which wraps the web app in a WebView and passes it off as an Android app. It was removed because:

- Google OAuth via Clerk modal doesn't work reliably in a WebView (no proper browser context)
- The web app uses browser-only APIs (IndexedDB, BroadcastChannel, Web Locks, Visual Viewport) that don't exist or behave differently inside a WebView
- WebView-based apps are visually and behaviourally different from native apps — no native gestures, no native navigation transitions, no haptics
- Apple and Google both scrutinize WebView wrappers during app review

The replacement is a true React Native app that renders to real native Android views. `View` compiles to `android.view.View`, `Text` to `TextView`, etc. The JavaScript runs in Hermes (Android's JS engine), not in a browser.

---

## Technology decisions

### Framework: Expo SDK 56 + React Native 0.85

**Why Expo over bare React Native:**
- Single `app.json` configures everything — permissions, icons, splash screen, plugins
- `expo prebuild` generates the native Android/iOS project from config (no manual native code to maintain)
- Expo modules (`expo-secure-store`, `expo-local-authentication`, etc.) are pre-built native modules with a consistent API
- EAS Build handles cloud APK/AAB generation without needing a local Android toolchain

**Why not Flutter, Kotlin/Compose, or Swift:**
- The monorepo already has React/TypeScript across the web app, extension, and shared utilities
- Convex has a React Native client; there is no official Kotlin or Dart client
- The shared package (`packages/shared`) and the Convex API types (`convex/_generated/`) would need to be reimplemented from scratch in any other language
- React Native renders native views — it is not a performance compromise

### Routing: Expo Router (file-based)

Expo Router maps files in `app/` to routes, similar to Next.js. The route tree is:

```
app/
├── _layout.tsx          → root (providers, crypto polyfill, splash)
├── index.tsx            → auth/encryption-aware redirect
├── (auth)/login.tsx     → Google OAuth screen
├── (tabs)/              → bottom tab bar group
│   ├── canvas.tsx
│   ├── todos.tsx
│   ├── notes.tsx
│   ├── bookmarks.tsx
│   └── more.tsx         → hub for secondary screens
├── events.tsx           → pushed from More
├── search.tsx
├── explore.tsx
├── insights.tsx
└── settings.tsx
```

The `(auth)` and `(tabs)` are route groups — they apply a layout without adding a path segment.

### Auth: @clerk/expo

Clerk's Expo SDK uses `expo-web-browser` to open Google OAuth in a Chrome Custom Tab (a real Android browser context, not a WebView). The OAuth flow:

1. User taps "Continue with Google"
2. `startSSOFlow` opens Chrome Custom Tab pointing to Clerk's OAuth endpoint
3. Google completes sign-in and redirects to `omanote://` (the app's deep link scheme)
4. The Custom Tab closes, the app receives the auth token
5. Clerk's `tokenCache` stores the session in Android Keystore via `expo-secure-store`

The Convex client uses `ConvexProviderWithClerk` with `useAuth` from `@clerk/expo`, which is the same integration pattern as the web app but with the mobile SDK.

**Clerk dashboard required setup:**
- Configure → Developers → Native Applications → Enable Native API
- Add Android app with package `com.iambishistha.omanote`
- Allowlist redirect URL: `omanote://`

### Encryption: react-native-quick-crypto

The web app uses the browser's Web Crypto API (`crypto.subtle`) for PBKDF2 key derivation and AES-GCM encryption. Hermes (React Native's JS engine) does not ship a complete SubtleCrypto implementation — `crypto.subtle` exists but is `undefined` at runtime.

`react-native-quick-crypto` provides a complete Web Crypto polyfill backed by BoringSSL (the same C++ library used by Chrome). It is installed via JSI (JavaScript Interface), which means it runs synchronously in the JS thread with no bridge overhead.

The polyfill is loaded as the very first import in `app/_layout.tsx` (via `shims/crypto.js`) so it is available before any auth or encryption code runs.

The crypto implementation in `lib/crypto.ts` is a direct port of the web app's `src/lib/crypto.ts` with the IndexedDB session cache removed (replaced by in-memory state in `EncryptionContext`). The encrypted format is identical, so content encrypted on the web decrypts correctly on mobile and vice versa.

### Local data: Convex real-time queries (no SQLite cache yet)

The web app uses Dexie (IndexedDB) as a local-first cache with incremental sync from Convex. React Native has no IndexedDB — the equivalent would be SQLite via `expo-sqlite`.

For the initial release, the mobile app queries Convex directly using `useQuery`. This means:
- Data loads on first open (requires network)
- Convex's real-time subscriptions keep data fresh automatically
- No offline support yet

SQLite local cache (mirroring the web app's Dexie sync pattern) is planned for a future release.

### Push notifications: expo-notifications (local, scheduled)

The web app uses the browser Notifications API with a polling loop. On mobile:

- `expo-notifications` schedules local notifications on-device for todos with a `dueTime`
- Notifications fire at the exact due time without a network request
- On app foreground, `useNotifications` hook cancels and reschedules all upcoming notifications to keep them in sync with Convex data
- No Firebase/FCM required for local notifications

Server-sent push notifications (for reminders triggered while the app is closed) would require FCM integration — not yet implemented.

---

## Monorepo structure

```
omanote/
├── src/               ← Web app (React + Vite + Tailwind)
├── apps/
│   └── mobile/        ← This app (Expo + React Native)
├── convex/            ← Shared backend — queries, mutations, schema
├── extension/         ← Browser extension (Chrome/Firefox)
└── packages/shared/   ← Pure-JS utilities shared across surfaces
```

The mobile app has exactly one dependency on the monorepo outside of `apps/mobile/`:

```ts
// apps/mobile/lib/api.ts
export { api } from '../../../convex/_generated/api';
```

This relative import works because `metro.config.js` adds the repo root to Metro's `watchFolders`. Everything else in `apps/mobile/` is self-contained with its own `node_modules`.

---

## Known build quirks

### Gradle 9 + foojay 0.5.0 incompatibility

`@react-native/gradle-plugin` bundles `foojay-resolver-convention` v0.5.0, which references `JvmVendorSpec.IBM_SEMERU` — a constant removed in Gradle 9.0. The `postinstall` script (`scripts/patch-foojay.js`) automatically upgrades it to v0.9.0 after every `npm install`.

Gradle 9.x is kept (not downgraded to 8.x) because it is the correct version and the fix is the right one.

### `android/local.properties`

`expo prebuild` regenerates the `android/` directory but does not write `local.properties` (which contains the SDK path). It must be created manually after every clean prebuild:

```bash
echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties
```

### `react-dom` stub

`@clerk/expo` depends on `@clerk/react` which imports `react-dom` for web Portal support. On React Native, `react-dom` does not exist. `shims/react-dom.js` is an empty module stub; `metro.config.js` aliases `react-dom` to this stub so Metro can resolve the import without the Portal code ever executing.

---

## Implementation phases

### Phase 1 — Foundation ✓
- Expo SDK 56 project scaffolded in `apps/mobile/`
- Expo Router with tab + stack navigation
- Clerk Google OAuth via Chrome Custom Tab
- Convex connected with `ConvexProviderWithClerk`
- Custom splash screen, app icon, dark background
- Light/dark theme auto-detected from system setting
- Bottom tab bar: Canvas, Todos, Notes, Bookmarks, More
- Secondary screens: Events, Search, Explore, Insights, Settings
- Empty states and loading states on all screens

### Phase 2 — Convex data integration ✓
- All screens connected to live Convex queries
- `TodoItem` with toggle (calls `todos.toggleTodo` mutation) and haptic feedback
- `NoteCard` with title and body preview
- `BookmarkCard` with favicon, domain, opens URL in system browser
- `EventItem` in a `SectionList` grouped by date
- Filter chips on Todos (All / Today / Overdue / Upcoming / Done)
- Folder chips on Notes
- Category chips on Bookmarks
- Search screen queries all three types client-side
- Create bottom sheets: todos, notes, events
- `lib/api.ts` bridge to `convex/_generated/api`
- `lib/utils.ts` — date formatting, URL parsing, text truncation

### Phase 3 — Native layer ✓
- `lib/crypto.ts` — PBKDF2 + AES-KW + AES-GCM (matches web app exactly)
- `react-native-quick-crypto` — polyfills `crypto.subtle` via BoringSSL
- `EncryptionContext` — holds unlocked `CryptoKey` in memory
- `UnlockView` — passphrase entry + biometric shortcut
- Biometric unlock: passphrase saved to Android Keystore, unlocked with fingerprint/face
- `useDecrypt` / `useDecryptMany` hooks — reactive decryption on all content fields
- All components decrypt: `TodoItem`, `NoteCard`, `BookmarkCard`, `EventItem`
- Push notifications: `expo-notifications` schedules local reminders for todos with `dueTime`
- `expo-auth-session` — required by `@clerk/expo` for SSO
- `expo-local-authentication` — biometric auth
- `expo-secure-store` — Android Keystore for Clerk token cache and passphrase

### Phase 4 — Polish (planned)
- Replace placeholder Expo icons with real Omanote branding (splash, app icon, adaptive icon)
- Edge-to-edge Android display (no grey navigation bar gap)
- Remove debug `console.log` statements added during development
- `eas.json` configured for development / preview / production profiles
- Animations: screen transitions, todo toggle animation (react-native-reanimated)
- Real Google icon SVG on the login screen (currently a placeholder "G" text)
- Android back gesture handling in bottom sheets
- Haptic feedback consistency pass across all interactions
- Production release build (AAB) — ~50MB vs 226MB debug build

### Future (not yet planned)
- SQLite local cache with incremental Convex sync (mirrors web app Dexie pattern)
- Offline support — queue mutations and flush on reconnect
- iOS App Store submission
- Server-sent push notifications via FCM (for closed-app reminders)
- Note editor — currently notes are read-only; a native markdown editor is needed
- Bookmark capture via Android share sheet (share a URL from any app → saved to Omanote)
- Explore screen — the force-directed graph from the web app; a React Native equivalent

---

## Screen inventory

| Screen | Location | Status | Notes |
|---|---|---|---|
| Login | `(auth)/login.tsx` | ✓ | Google OAuth via Chrome Custom Tab |
| Encryption unlock | `components/UnlockView.tsx` | ✓ | Passphrase + biometric |
| Canvas | `(tabs)/canvas.tsx` | ✓ | Shows today's pinned todos |
| Todos | `(tabs)/todos.tsx` | ✓ | 5 filters, toggle, create sheet |
| Notes | `(tabs)/notes.tsx` | ✓ | Folder filter, cards, create sheet |
| Bookmarks | `(tabs)/bookmarks.tsx` | ✓ | Category filter, opens URLs |
| More | `(tabs)/more.tsx` | ✓ | User profile + nav to secondary screens |
| Events | `events.tsx` | ✓ | Timeline grouped by date, log sheet |
| Search | `search.tsx` | ✓ | Live client-side filter across 3 types |
| Explore | `explore.tsx` | Stub | Empty state only |
| Insights | `insights.tsx` | Stub | Empty state only |
| Settings | `settings.tsx` | Stub | Sign out works; settings rows are stubs |

---

## Environment variables

| Variable | Where to get it |
|---|---|
| `EXPO_PUBLIC_CONVEX_URL` | Same as `VITE_CONVEX_URL` in root `.env.local` |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same as `VITE_CLERK_PUBLISHABLE_KEY` in root `.env.local` |

Both go in `apps/mobile/.env.local` (gitignored).
