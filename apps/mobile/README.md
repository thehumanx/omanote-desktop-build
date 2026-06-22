# Omanote Mobile App

Native Android (and iOS) app for Omanote. Built with [Expo](https://expo.dev) and React Native — renders real native Android/iOS views, not a webview wrapper.

---

## How this fits into the monorepo

```
omanote/
├── src/              ← Web app (React + Vite)
├── apps/
│   └── mobile/       ← This app (Expo + React Native)
├── convex/           ← Shared backend (used by both web and mobile)
├── extension/        ← Browser extension
└── packages/shared/  ← Shared utilities
```

The mobile app shares the Convex backend with the web app. All screens, components, and logic are fully independent. Both live in the same git repository so the backend stays in sync automatically.

---

## Prerequisites

### 1. Java JDK 17 or higher

```bash
java -version
```

If not installed: https://adoptium.net (choose "Temurin 17 LTS")

### 2. Android SDK

You do **not** need Android Studio IDE — just the SDK tools. If you already have an Android emulator set up, you already have the SDK.

Check if `adb` is available:
```bash
adb devices
```

If `adb` is not found, set `ANDROID_HOME` permanently by adding to your `~/.zshrc`:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

Then run `source ~/.zshrc`.

### 3. Android emulator or physical device

**Emulator:** Start it before building. Verify it shows up:
```bash
adb devices
# emulator-5554   device
```

**Physical device:**
1. Settings → About Phone → tap "Build Number" 7 times
2. Settings → Developer Options → enable "USB Debugging"
3. Connect via USB

---

## Third-party setup (one-time)

### Convex
No changes needed — the mobile app connects to the same deployment as the web app.

### Clerk — native app registration

1. Go to [clerk.com](https://clerk.com) → your Omanote project
2. Sidebar: **Configure → Developers → Native applications**
3. **Enable Native API** toggle at the top
4. Click **+ Add Android app**:
   - Package name: `com.iambishistha.omanote`
   - SHA-256 fingerprint: leave blank (only needed for Play Store)
5. Scroll to **"Allowlist for mobile SSO redirect"** → type `omanote://` → click **Add**

For iOS (when ready): same page → iOS tab → bundle ID `com.iambishistha.omanote` → redirect `omanote://`

---

## Local environment setup

Create `apps/mobile/.env.local` (gitignored — never commit this):

```bash
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Copy both values from the web app's `.env.local` at the repo root:
- `VITE_CONVEX_URL` → `EXPO_PUBLIC_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY` → `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

---

## Running the app (development)

Development has two parts that run simultaneously: the **Metro bundler** (serves JS) and the **native APK** (installed on device).

### Step 1 — Start Metro

```bash
cd apps/mobile
npx expo start --clear
```

Keep this terminal open. Metro serves the JavaScript to the app in real time.

### Step 2 — Build and install the APK (first time only)

```bash
# Generate the native Android project
npx expo prebuild --platform android

# Write the SDK path (required, gitignored)
echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties

# Build the APK
cd android
ANDROID_HOME=~/Library/Android/sdk ./gradlew app:assembleDebug -x lint -x test

# Install on your emulator/device
~/Library/Android/sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk
```

First build takes 5–10 minutes. Subsequent builds take ~1 minute.

### Step 3 — Open the app

Open Omanote on your device. It connects to Metro automatically.

After that, **JS changes** (most edits) only need a Metro reload — shake the device or press `R R` in the Metro terminal. **Native changes** (adding packages with native code) need a full rebuild from Step 2.

---

## When you need a full rebuild vs just Metro reload

| Change type | What to do |
|---|---|
| Edit a `.tsx` / `.ts` / `.js` file | Reload Metro only (`R R`) |
| Add a pure-JS npm package | Reload Metro only |
| Add a native npm package (e.g. `expo-camera`) | Full rebuild from Step 2 |
| Change `app.json` | Full rebuild from Step 2 |

---

## Known issues and fixes

### Gradle 9 + foojay incompatibility

`@react-native/gradle-plugin` ships an old version of the `foojay-resolver` plugin that doesn't support Gradle 9. The `postinstall` script in `package.json` automatically patches it to version 0.9.0 whenever you run `npm install`. If you ever see this error:

```
NoSuchFieldError: JvmVendorSpec does not have member field IBM_SEMERU
```

Run manually:
```bash
node scripts/patch-foojay.js
```

### `local.properties` missing

`expo prebuild` does not generate `android/local.properties`. You must create it manually after every prebuild:
```bash
echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties
```

### `ANDROID_HOME` not set

If Gradle can't find the SDK, set it explicitly in the build command:
```bash
ANDROID_HOME=~/Library/Android/sdk ./gradlew app:assembleDebug -x lint -x test
```

Or set it permanently in `~/.zshrc` (see Prerequisites above).

### Encryption passphrase not working

The app uses the Web Crypto API for AES-GCM encryption. Hermes (React Native's JS engine) does not ship a complete implementation — the app uses `react-native-quick-crypto` to polyfill it via BoringSSL. If you ever see `crypto.subtle is undefined`, make sure `react-native-quick-crypto` is installed and the APK has been rebuilt after installing it.

---

## Building a release APK

For a proper signed APK without the Metro dev server dependency, use EAS Build (builds in the cloud — no local Android toolchain required):

```bash
# One-time setup
npm install -g eas-cli
eas login   # create a free account at expo.dev

# From apps/mobile:
eas build --platform android --profile preview
```

EAS builds take ~15 minutes and give you a download link. Install with:
```bash
adb install downloaded-file.apk
```

For Play Store upload:
```bash
eas build --platform android --profile production
```

---

## App details

| Property | Value |
|---|---|
| Package ID | `com.iambishistha.omanote` |
| Deep link scheme | `omanote://` |
| Min Android version | Android 7.0 (API 24) |
| Expo SDK | 56 |
| React Native | 0.85.3 |
| Auth | Clerk + Google OAuth |
| Backend | Convex (shared with web app) |
| Crypto | react-native-quick-crypto (BoringSSL) |

---

## Project structure

```
apps/mobile/
├── app/                       # Screens — Expo Router file-based routing
│   ├── _layout.tsx            # Root: ClerkProvider + ConvexProvider + crypto polyfill
│   ├── index.tsx              # Entry: redirects based on auth + encryption state
│   ├── (auth)/login.tsx       # Google sign-in
│   ├── (tabs)/                # Bottom tab bar
│   │   ├── canvas.tsx         # Daily workspace (home tab)
│   │   ├── todos.tsx          # Tasks with filter: All/Today/Overdue/Upcoming/Done
│   │   ├── notes.tsx          # Markdown notes with folder filter
│   │   ├── bookmarks.tsx      # Saved links with category filter
│   │   └── more.tsx           # Hub for Events, Search, Explore, Insights, Settings
│   ├── events.tsx             # Activity timeline
│   ├── search.tsx             # Full-text search across all content
│   ├── explore.tsx            # Hashtag explorer
│   ├── insights.tsx           # Activity stats
│   └── settings.tsx           # Preferences, encryption, sign out
├── components/                # Reusable UI components
│   ├── TodoItem.tsx           # Todo row with toggle + decryption
│   ├── NoteCard.tsx           # Note preview card with decryption
│   ├── BookmarkCard.tsx       # Bookmark row with decryption
│   ├── EventItem.tsx          # Event timeline row with decryption
│   ├── UnlockView.tsx         # Full-screen passphrase + biometric unlock
│   ├── CreateTodoSheet.tsx    # Bottom sheet: create todo
│   ├── CreateNoteSheet.tsx    # Bottom sheet: create note
│   └── LogEventSheet.tsx      # Bottom sheet: log event
├── contexts/
│   └── EncryptionContext.tsx  # Holds decrypted key in memory; exposes decrypt()
├── hooks/
│   ├── useDecrypt.ts          # Reactive decryption hook for any string
│   ├── useTheme.ts            # Light/dark theme from system setting
│   └── useNotifications.ts   # Schedules push notifications for reminders
├── lib/
│   ├── api.ts                 # Bridge to convex/_generated/api
│   ├── crypto.ts              # PBKDF2 + AES-KW + AES-GCM (matches web app format)
│   ├── notifications.ts       # expo-notifications scheduling helpers
│   ├── theme.ts               # Design tokens: light + dark colours
│   └── utils.ts               # Date formatting, URL parsing, text truncation
├── shims/
│   ├── crypto.js              # Calls react-native-quick-crypto install()
│   └── react-dom.js           # Empty stub — satisfies @clerk/react import on native
├── scripts/
│   ├── patch-foojay.js        # Patches foojay 0.5.0 → 0.9.0 in RN gradle plugin
│   └── fix-android.sh         # Helper: writes local.properties + runs patch
├── assets/                    # App icon, splash screen images
├── app.json                   # Expo config: package ID, scheme, permissions, plugins
├── babel.config.js            # Uses react-native-worklets/plugin (reanimated v4)
├── metro.config.js            # Watches monorepo root for convex/ imports
└── .env.local                 # Local env vars (gitignored — create this yourself)
```

---

## Encryption

The mobile app uses the same end-to-end encryption as the web app:

- **Algorithm:** AES-GCM-256 for content, PBKDF2 (310k iterations) + AES-KW for key wrapping
- **Key storage:** The wrapped key lives in Convex. The passphrase never leaves the device.
- **Session:** The unwrapped `CryptoKey` lives in `EncryptionContext` memory only — cleared on sign-out.
- **Biometric:** Passphrase can be saved to the Android Keystore and unlocked with fingerprint/face.
- **Cross-platform:** Encrypted blobs written by the web app decrypt correctly on mobile and vice versa.

The `useDecrypt` hook makes decryption reactive — content decrypts automatically once the user unlocks, without any manual refresh.
