# Settings Page Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full `/settings` experience with categorized personalization controls for security, editor shortcuts, notifications, data tools, and account deletion.

**Architecture:** Introduce a persistent `userSettings` model in Convex and a `UserSettingsProvider` in the React app to deliver one source of truth for runtime behavior. Refactor save/newline shortcut handling and hint rendering into shared utilities/components so behavior is consistent across all editors. Consolidate export/import/recovery controls into the settings screen and add a guarded delete-account flow that deletes Convex user data before Clerk account deletion.

**Tech Stack:** React 18, TypeScript, Vite, Convex, Clerk, Vitest, Testing Library

---

## File Structure

### New files
- `vitest.config.ts` — test runner config for `jsdom` and Convex edge-runtime tests.
- `src/test/setup.ts` — global test setup (`@testing-library/jest-dom`).
- `src/lib/user-settings.ts` — settings types, defaults, normalization, and option constants.
- `src/lib/editor-shortcuts.ts` — centralized save/newline shortcut matching and labels.
- `src/lib/reminder-schedule.ts` — reminder trigger-time calculation helpers.
- `src/lib/notification-permission.ts` — browser-notification dismissal key helpers.
- `src/lib/passphrase-form.ts` — validation helpers for passphrase-change form.
- `src/contexts/UserSettingsContext.tsx` — query/mutation-backed settings provider + hook.
- `src/components/settings/SaveShortcutHint.tsx` — reusable conditional hint text component.
- `src/screens/SettingsScreen.tsx` — categorized settings page UI.
- `convex/userSettings.ts` — get/upsert user settings API.
- `convex/account.ts` — user data deletion mutation for account removal flow.
- `src/lib/editor-shortcuts.test.ts` — shortcut behavior tests.
- `src/lib/user-settings.test.ts` — normalization and defaults tests.
- `src/lib/reminder-schedule.test.ts` — lead-time and snooze behavior tests.
- `src/lib/passphrase-form.test.ts` — passphrase validation tests.
- `src/components/settings/SaveShortcutHint.test.tsx` — hint visibility/label tests.
- `src/screens/SettingsScreen.test.tsx` — settings categories and conflict messaging tests.
- `convex/userSettings.test.ts` — Convex mutation/query tests.
- `convex/account.test.ts` — Convex data-deletion mutation tests.

### Modified files
- `package.json` — add `test` scripts and test dev dependencies.
- `tsconfig.json` — include Vitest typing support.
- `src/App.tsx` — register `/settings` route and provider wiring.
- `src/app/auth/AuthContext.tsx` — expose `deleteAccount` action.
- `src/contexts/EncryptionContext.tsx` — add `changePassphrase` API.
- `src/components/layout/BottomNav.tsx` — move profile menu actions to settings entry.
- `src/components/layout/TopBar.tsx` — move profile menu actions to settings entry.
- `src/components/NotificationPermissionBanner.tsx` — obey settings + shared dismissal key.
- `src/components/ReminderMonitor.tsx` — apply lead time + channel toggles.
- `src/components/ToastHost.tsx` — use default snooze + configurable reminder duration.
- `src/components/CanvasDraftBlock.tsx` — use configurable save/newline shortcuts + shared hints.
- `src/components/NoteInlineEditor.tsx` — use configurable save/newline shortcuts + shared hints.
- `src/components/NoteCanvasEditor.tsx` — use configurable save/newline shortcuts + shared hints.
- `src/components/TodoEditorModal.tsx` — use configurable save shortcut + shared hint.
- `src/components/EventEditorModal.tsx` — use configurable save shortcut + shared hint.
- `src/screens/EventScreen.tsx` — use configurable save shortcut + shared hint in create modal.
- `convex/schema.ts` — add `userSettings` table.
- `README.md` — document new settings page capabilities.

---

### Task 1: Add Test Harness and Core Settings Domain Utilities

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/lib/user-settings.ts`
- Create: `src/lib/editor-shortcuts.ts`
- Test: `src/lib/user-settings.test.ts`
- Test: `src/lib/editor-shortcuts.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write failing tests for settings defaults and shortcut matching**

```ts
// src/lib/user-settings.test.ts
import { describe, expect, it } from "vitest";
import { DEFAULT_USER_SETTINGS, normalizeUserSettings } from "./user-settings";

describe("user-settings", () => {
  it("returns defaults when no server settings exist", () => {
    expect(normalizeUserSettings(null)).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("resolves shortcut conflict by forcing newline to shift_enter when save is enter", () => {
    const normalized = normalizeUserSettings({
      saveShortcut: "enter",
      newlineShortcut: "enter",
    });
    expect(normalized.saveShortcut).toBe("enter");
    expect(normalized.newlineShortcut).toBe("shift_enter");
  });
});

// src/lib/editor-shortcuts.test.ts
import { describe, expect, it } from "vitest";
import { isSaveShortcutEvent, type SaveShortcut } from "./editor-shortcuts";

function eventStub(partial: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: partial.key ?? "",
    metaKey: Boolean(partial.metaKey),
    ctrlKey: Boolean(partial.ctrlKey),
    shiftKey: Boolean(partial.shiftKey),
    altKey: Boolean(partial.altKey),
  } as KeyboardEvent;
}

describe("editor-shortcuts", () => {
  it.each<SaveShortcut>(["mod_enter", "enter", "shift_enter"])("matches save shortcut %s", (shortcut) => {
    const evt =
      shortcut === "mod_enter"
        ? eventStub({ key: "Enter", ctrlKey: true })
        : shortcut === "enter"
          ? eventStub({ key: "Enter" })
          : eventStub({ key: "Enter", shiftKey: true });

    expect(isSaveShortcutEvent(evt, shortcut)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run src/lib/user-settings.test.ts src/lib/editor-shortcuts.test.ts`
Expected: FAIL with module-not-found errors for `./user-settings` and `./editor-shortcuts`.

- [ ] **Step 3: Add test tooling and implement domain utilities**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    environmentMatchGlobs: [["convex/**/*.test.ts", "edge-runtime"]],
  },
});

// src/lib/user-settings.ts
export type SaveShortcut = "mod_enter" | "enter" | "shift_enter";
export type NewlineShortcut = "enter" | "shift_enter";
export type ReminderLeadMinutes = 0 | 5 | 10 | 15;

export interface UserSettings {
  saveShortcut: SaveShortcut;
  newlineShortcut: NewlineShortcut;
  showSaveShortcutHints: boolean;
  inAppReminderNotifications: boolean;
  browserReminderNotifications: boolean;
  reminderLeadMinutes: ReminderLeadMinutes;
  defaultSnoozeMinutes: 5 | 10 | 15 | 30;
  reminderToastDurationSeconds: 10 | 20 | 30 | 60;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  saveShortcut: "mod_enter",
  newlineShortcut: "enter",
  showSaveShortcutHints: true,
  inAppReminderNotifications: true,
  browserReminderNotifications: true,
  reminderLeadMinutes: 0,
  defaultSnoozeMinutes: 10,
  reminderToastDurationSeconds: 30,
};

export function normalizeUserSettings(input: Partial<UserSettings> | null | undefined): UserSettings {
  const merged: UserSettings = { ...DEFAULT_USER_SETTINGS, ...(input ?? {}) };
  if (merged.saveShortcut === "enter" && merged.newlineShortcut === "enter") {
    merged.newlineShortcut = "shift_enter";
  }
  if (merged.saveShortcut === "shift_enter" && merged.newlineShortcut === "shift_enter") {
    merged.newlineShortcut = "enter";
  }
  return merged;
}

// src/lib/editor-shortcuts.ts
import type { NewlineShortcut, SaveShortcut } from "./user-settings";

export function isSaveShortcutEvent(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">, shortcut: SaveShortcut) {
  if (event.key !== "Enter") return false;
  if (shortcut === "mod_enter") return (event.metaKey || event.ctrlKey) && !event.shiftKey;
  if (shortcut === "enter") return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  return event.shiftKey && !event.metaKey && !event.ctrlKey;
}

export function isNewlineShortcutEvent(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">, shortcut: NewlineShortcut) {
  if (event.key !== "Enter") return false;
  if (shortcut === "enter") return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  return event.shiftKey && !event.metaKey && !event.ctrlKey;
}

export function formatSaveShortcutLabel(shortcut: SaveShortcut) {
  if (shortcut === "enter") return "Enter";
  if (shortcut === "shift_enter") return "Shift + Enter";
  return "Cmd/Ctrl + Enter";
}
```

```json
// package.json (scripts + devDependencies excerpt)
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@edge-runtime/vm": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "convex-test": "latest",
    "jsdom": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test -- src/lib/user-settings.test.ts src/lib/editor-shortcuts.test.ts`
Expected: PASS with all assertions green.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/test/setup.ts src/lib/user-settings.ts src/lib/editor-shortcuts.ts src/lib/user-settings.test.ts src/lib/editor-shortcuts.test.ts
git commit -m "test: add settings domain utilities and shortcut matcher coverage"
```

---

### Task 2: Add Convex `userSettings` Persistence API

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/userSettings.ts`
- Test: `convex/userSettings.test.ts`

- [ ] **Step 1: Write failing Convex tests for get/upsert behavior**

```ts
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("userSettings", () => {
  it("returns null before settings are saved", async () => {
    const t = convexTest(schema, modules);
    const settings = await t.query(api.userSettings.getMySettings, {});
    expect(settings).toBeNull();
  });

  it("upserts and then patches settings", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.userSettings.upsertMySettings, {
      saveShortcut: "enter",
      newlineShortcut: "shift_enter",
      showSaveShortcutHints: false,
    });

    await t.mutation(api.userSettings.upsertMySettings, {
      defaultSnoozeMinutes: 15,
    });

    const settings = await t.query(api.userSettings.getMySettings, {});
    expect(settings?.saveShortcut).toBe("enter");
    expect(settings?.defaultSnoozeMinutes).toBe(15);
  });
});
```

- [ ] **Step 2: Run Convex test to verify failure**

Run: `npm run test -- convex/userSettings.test.ts`
Expected: FAIL with `api.userSettings` not found.

- [ ] **Step 3: Implement schema + API + regenerate Convex types**

```ts
// convex/schema.ts (new table)
userSettings: defineTable({
  userId: v.string(),
  saveShortcut: v.union(v.literal("mod_enter"), v.literal("enter"), v.literal("shift_enter")),
  newlineShortcut: v.union(v.literal("enter"), v.literal("shift_enter")),
  showSaveShortcutHints: v.boolean(),
  inAppReminderNotifications: v.boolean(),
  browserReminderNotifications: v.boolean(),
  reminderLeadMinutes: v.union(v.literal(0), v.literal(5), v.literal(10), v.literal(15)),
  defaultSnoozeMinutes: v.union(v.literal(5), v.literal(10), v.literal(15), v.literal(30)),
  reminderToastDurationSeconds: v.union(v.literal(10), v.literal(20), v.literal(30), v.literal(60)),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_userId", ["userId"]),
```

```ts
// convex/userSettings.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./utils";

export const getMySettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db.query("userSettings").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
  },
});

export const upsertMySettings = mutation({
  args: {
    saveShortcut: v.optional(v.union(v.literal("mod_enter"), v.literal("enter"), v.literal("shift_enter"))),
    newlineShortcut: v.optional(v.union(v.literal("enter"), v.literal("shift_enter"))),
    showSaveShortcutHints: v.optional(v.boolean()),
    inAppReminderNotifications: v.optional(v.boolean()),
    browserReminderNotifications: v.optional(v.boolean()),
    reminderLeadMinutes: v.optional(v.union(v.literal(0), v.literal(5), v.literal(10), v.literal(15))),
    defaultSnoozeMinutes: v.optional(v.union(v.literal(5), v.literal(10), v.literal(15), v.literal(30))),
    reminderToastDurationSeconds: v.optional(v.union(v.literal(10), v.literal(20), v.literal(30), v.literal(60))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const now = Date.now();

    const existing = await ctx.db.query("userSettings").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();

    const patch = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));

    if (existing) {
      await ctx.db.patch(existing._id, { ...patch, updatedAt: now });
      return existing._id;
    }

    return ctx.db.insert("userSettings", {
      userId,
      saveShortcut: args.saveShortcut ?? "mod_enter",
      newlineShortcut: args.newlineShortcut ?? "enter",
      showSaveShortcutHints: args.showSaveShortcutHints ?? true,
      inAppReminderNotifications: args.inAppReminderNotifications ?? true,
      browserReminderNotifications: args.browserReminderNotifications ?? true,
      reminderLeadMinutes: args.reminderLeadMinutes ?? 0,
      defaultSnoozeMinutes: args.defaultSnoozeMinutes ?? 10,
      reminderToastDurationSeconds: args.reminderToastDurationSeconds ?? 30,
      createdAt: now,
      updatedAt: now,
    });
  },
});
```

Run: `npx convex codegen`

- [ ] **Step 4: Re-run tests to verify pass**

Run: `npm run test -- convex/userSettings.test.ts`
Expected: PASS for both query/mutation tests.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/userSettings.ts convex/userSettings.test.ts convex/_generated/api.d.ts convex/_generated/api.js
 git commit -m "feat: add persistent user settings model in Convex"
```

---

### Task 3: Add Settings Provider and App-Wide Hook

**Files:**
- Create: `src/contexts/UserSettingsContext.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/user-settings.ts`
- Test: `src/lib/user-settings.test.ts`

- [ ] **Step 1: Add failing tests for server-document normalization**

```ts
// src/lib/user-settings.test.ts (append)
it("keeps explicit server values when no conflict exists", () => {
  const normalized = normalizeUserSettings({
    saveShortcut: "mod_enter",
    newlineShortcut: "shift_enter",
    showSaveShortcutHints: false,
  });

  expect(normalized.saveShortcut).toBe("mod_enter");
  expect(normalized.newlineShortcut).toBe("shift_enter");
  expect(normalized.showSaveShortcutHints).toBe(false);
});
```

- [ ] **Step 2: Run targeted tests to confirm failure**

Run: `npm run test -- src/lib/user-settings.test.ts`
Expected: FAIL if normalization currently drops explicit values.

- [ ] **Step 3: Implement provider and wire into authenticated app tree**

```tsx
// src/contexts/UserSettingsContext.tsx
import { createContext, useCallback, useContext, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_USER_SETTINGS, normalizeUserSettings, type UserSettings } from "../lib/user-settings";

type UserSettingsContextValue = {
  settings: UserSettings;
  loading: boolean;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
};

const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const settingsDoc = useQuery(api.userSettings.getMySettings, {});
  const upsertSettings = useMutation(api.userSettings.upsertMySettings);

  const settings = useMemo(() => {
    if (settingsDoc === undefined) return DEFAULT_USER_SETTINGS;
    if (settingsDoc === null) return DEFAULT_USER_SETTINGS;
    return normalizeUserSettings(settingsDoc);
  }, [settingsDoc]);

  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    await upsertSettings(patch);
  }, [upsertSettings]);

  const value = useMemo(() => ({ settings, loading: settingsDoc === undefined, updateSettings }), [settings, settingsDoc, updateSettings]);

  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
}

export function useUserSettings() {
  const value = useContext(UserSettingsContext);
  if (!value) throw new Error("useUserSettings must be used inside UserSettingsProvider");
  return value;
}
```

```tsx
// src/App.tsx (RootRoute excerpt)
return (
  <AuthProvider>
    <EncryptionProvider>
      <EncryptionGate>
        <UserSettingsProvider>
          <AppProvider>
            <AppShell />
          </AppProvider>
        </UserSettingsProvider>
      </EncryptionGate>
    </EncryptionProvider>
  </AuthProvider>
);
```

- [ ] **Step 4: Re-run tests to verify pass**

Run: `npm run test -- src/lib/user-settings.test.ts`
Expected: PASS for all normalization tests.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/UserSettingsContext.tsx src/App.tsx src/lib/user-settings.ts src/lib/user-settings.test.ts
git commit -m "feat: add app-wide user settings provider"
```

---

### Task 4: Build `/settings` Route and Category-Based Page Layout

**Files:**
- Create: `src/screens/SettingsScreen.tsx`
- Test: `src/screens/SettingsScreen.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/BottomNav.tsx`
- Modify: `src/components/layout/TopBar.tsx`

- [ ] **Step 1: Write a failing screen test for required category headings**

```tsx
// src/screens/SettingsScreen.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "./SettingsScreen";

vi.mock("../contexts/UserSettingsContext", () => ({
  useUserSettings: () => ({
    settings: {
      saveShortcut: "mod_enter",
      newlineShortcut: "enter",
      showSaveShortcutHints: true,
      inAppReminderNotifications: true,
      browserReminderNotifications: true,
      reminderLeadMinutes: 0,
      defaultSnoozeMinutes: 10,
      reminderToastDurationSeconds: 30,
    },
    loading: false,
    updateSettings: vi.fn(),
  }),
}));

describe("SettingsScreen", () => {
  it("renders all required categories", () => {
    render(<SettingsScreen />);
    expect(screen.getByRole("heading", { name: "Editor" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Data" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the screen test to verify failure**

Run: `npm run test -- src/screens/SettingsScreen.test.tsx`
Expected: FAIL with module-not-found for `SettingsScreen`.

- [ ] **Step 3: Implement route + screen skeleton + profile navigation entry**

```tsx
// src/App.tsx (route excerpt)
import { SettingsScreen } from "./screens/SettingsScreen";

<Route path="settings" element={<SettingsScreen />} />
```

```tsx
// src/screens/SettingsScreen.tsx (skeleton)
import { useMemo } from "react";
import { useTopChrome } from "../components/layout/useTopChrome";

export function SettingsScreen() {
  const topChrome = useMemo(
    () => (
      <div className="flex h-full w-full items-center">
        <h1 className="truncate text-lg font-semibold text-zinc-900">Settings</h1>
      </div>
    ),
    [],
  );
  useTopChrome(topChrome);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 pb-24 pt-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="text-base font-semibold text-zinc-900">Editor</h2></section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="text-base font-semibold text-zinc-900">Notifications</h2></section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="text-base font-semibold text-zinc-900">Security</h2></section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="text-base font-semibold text-zinc-900">Data</h2></section>
      <section className="rounded-2xl border border-red-200 bg-white p-5"><h2 className="text-base font-semibold text-red-700">Account</h2></section>
    </div>
  );
}
```

```tsx
// BottomNav.tsx + TopBar.tsx (profile menu item)
<button
  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900"
  onClick={() => {
    navigate("/settings");
    setMenuOpen(false);
  }}
>
  <FileText className="h-4 w-4" />
  Settings
</button>
```

- [ ] **Step 4: Re-run test to verify pass**

Run: `npm run test -- src/screens/SettingsScreen.test.tsx`
Expected: PASS with all category headings found.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/screens/SettingsScreen.tsx src/screens/SettingsScreen.test.tsx src/components/layout/BottomNav.tsx src/components/layout/TopBar.tsx
git commit -m "feat: add settings route and category layout"
```

---

### Task 5: Add Save/Newline Shortcut Config UI and Conflict Guard

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/lib/editor-shortcuts.ts`
- Test: `src/lib/editor-shortcuts.test.ts`

- [ ] **Step 1: Add failing tests for shortcut conflict detection**

```ts
// src/lib/editor-shortcuts.test.ts (append)
import { hasShortcutConflict } from "./editor-shortcuts";

it("flags conflict when save and newline are both enter", () => {
  expect(hasShortcutConflict("enter", "enter")).toBe(true);
});

it("does not flag conflict for mod_enter save with enter newline", () => {
  expect(hasShortcutConflict("mod_enter", "enter")).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- src/lib/editor-shortcuts.test.ts`
Expected: FAIL because `hasShortcutConflict` does not exist yet.

- [ ] **Step 3: Implement conflict helper and settings editor controls**

```ts
// src/lib/editor-shortcuts.ts
import type { NewlineShortcut, SaveShortcut } from "./user-settings";

export function hasShortcutConflict(saveShortcut: SaveShortcut, newlineShortcut: NewlineShortcut) {
  return saveShortcut === "enter" ? newlineShortcut === "enter" : saveShortcut === "shift_enter" ? newlineShortcut === "shift_enter" : false;
}
```

```tsx
// SettingsScreen.tsx (Editor section excerpt)
const [draftSaveShortcut, setDraftSaveShortcut] = useState(settings.saveShortcut);
const [draftNewlineShortcut, setDraftNewlineShortcut] = useState(settings.newlineShortcut);
const shortcutConflict = hasShortcutConflict(draftSaveShortcut, draftNewlineShortcut);

<button
  className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
  disabled={shortcutConflict}
  onClick={() => void updateSettings({ saveShortcut: draftSaveShortcut, newlineShortcut: draftNewlineShortcut })}
>
  Save shortcuts
</button>

{shortcutConflict ? (
  <p className="mt-2 text-sm text-rose-600">Save and newline shortcuts conflict. Choose different keys.</p>
) : null}
```

- [ ] **Step 4: Re-run tests**

Run: `npm run test -- src/lib/editor-shortcuts.test.ts src/screens/SettingsScreen.test.tsx`
Expected: PASS with conflict helper assertions and existing screen test still green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor-shortcuts.ts src/lib/editor-shortcuts.test.ts src/screens/SettingsScreen.tsx
git commit -m "feat: add configurable save/newline shortcut settings with conflict guard"
```

---

### Task 6: Apply Shortcut Settings and Centralize Save Help Text

**Files:**
- Create: `src/components/settings/SaveShortcutHint.tsx`
- Test: `src/components/settings/SaveShortcutHint.test.tsx`
- Modify: `src/components/CanvasDraftBlock.tsx`
- Modify: `src/components/NoteInlineEditor.tsx`
- Modify: `src/components/NoteCanvasEditor.tsx`
- Modify: `src/components/TodoEditorModal.tsx`
- Modify: `src/components/EventEditorModal.tsx`
- Modify: `src/screens/EventScreen.tsx`

- [ ] **Step 1: Write failing test for hint visibility and label formatting**

```tsx
// src/components/settings/SaveShortcutHint.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveShortcutHint } from "./SaveShortcutHint";

vi.mock("../../contexts/UserSettingsContext", () => ({
  useUserSettings: () => ({
    settings: {
      saveShortcut: "shift_enter",
      newlineShortcut: "enter",
      showSaveShortcutHints: true,
      inAppReminderNotifications: true,
      browserReminderNotifications: true,
      reminderLeadMinutes: 0,
      defaultSnoozeMinutes: 10,
      reminderToastDurationSeconds: 30,
    },
  }),
}));

describe("SaveShortcutHint", () => {
  it("shows formatted save label", () => {
    render(<SaveShortcutHint />);
    expect(screen.getByText("Press Shift + Enter to save")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/components/settings/SaveShortcutHint.test.tsx`
Expected: FAIL because `SaveShortcutHint` does not exist.

- [ ] **Step 3: Implement shared hint component and replace hardcoded save shortcut text/keydown checks**

```tsx
// src/components/settings/SaveShortcutHint.tsx
import { formatSaveShortcutLabel } from "../../lib/editor-shortcuts";
import { useUserSettings } from "../../contexts/UserSettingsContext";

export function SaveShortcutHint({ className = "text-xs text-zinc-400" }: { className?: string }) {
  const { settings } = useUserSettings();
  if (!settings.showSaveShortcutHints) return null;
  return <span className={className}>{`Press ${formatSaveShortcutLabel(settings.saveShortcut)} to save`}</span>;
}
```

```tsx
// Example editor keydown excerpt (apply same pattern in all listed editors)
if (event.key === "Enter") {
  if (isSaveShortcutEvent(event, settings.saveShortcut)) {
    event.preventDefault();
    commit();
    return;
  }

  if (isNewlineShortcutEvent(event, settings.newlineShortcut)) {
    return; // keep default newline behavior
  }

  event.preventDefault();
}
```

```tsx
// Example replacement of hardcoded hint spans
<div className="flex items-center gap-2">
  <SaveShortcutHint className="hidden text-xs text-zinc-400 md:block" />
  {canSaveCurrent ? <MobileSaveButton onClick={handleMobileSave} /> : null}
</div>
```

- [ ] **Step 4: Run targeted tests + typecheck**

Run: `npm run test -- src/components/settings/SaveShortcutHint.test.tsx src/lib/editor-shortcuts.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/SaveShortcutHint.tsx src/components/settings/SaveShortcutHint.test.tsx src/components/CanvasDraftBlock.tsx src/components/NoteInlineEditor.tsx src/components/NoteCanvasEditor.tsx src/components/TodoEditorModal.tsx src/components/EventEditorModal.tsx src/screens/EventScreen.tsx
git commit -m "feat: apply configurable save shortcuts and centralized save hints"
```

---

### Task 7: Implement Notification Preferences and Runtime Reminder Behavior

**Files:**
- Create: `src/lib/reminder-schedule.ts`
- Create: `src/lib/notification-permission.ts`
- Test: `src/lib/reminder-schedule.test.ts`
- Modify: `src/components/ReminderMonitor.tsx`
- Modify: `src/components/ToastHost.tsx`
- Modify: `src/components/NotificationPermissionBanner.tsx`
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Write failing tests for reminder lead-time math**

```ts
// src/lib/reminder-schedule.test.ts
import { describe, expect, it } from "vitest";
import { computeReminderTriggerAt } from "./reminder-schedule";

describe("reminder-schedule", () => {
  it("triggers exactly on due time when lead is 0", () => {
    const due = new Date("2026-04-23T10:00:00.000Z");
    expect(computeReminderTriggerAt(due, 0).toISOString()).toBe("2026-04-23T10:00:00.000Z");
  });

  it("triggers 15 minutes early when lead is 15", () => {
    const due = new Date("2026-04-23T10:00:00.000Z");
    expect(computeReminderTriggerAt(due, 15).toISOString()).toBe("2026-04-23T09:45:00.000Z");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- src/lib/reminder-schedule.test.ts`
Expected: FAIL because `reminder-schedule` module does not exist.

- [ ] **Step 3: Implement reminder helper, banner helpers, and settings-aware runtime usage**

```ts
// src/lib/reminder-schedule.ts
export function computeReminderTriggerAt(dueAt: Date, leadMinutes: 0 | 5 | 10 | 15) {
  return new Date(dueAt.getTime() - leadMinutes * 60_000);
}
```

```ts
// src/lib/notification-permission.ts
export const NOTIFICATION_BANNER_DISMISSED_KEY = "omanote:notification-permission-dismissed";

export function isNotificationBannerDismissed() {
  return localStorage.getItem(NOTIFICATION_BANNER_DISMISSED_KEY) === "true";
}

export function setNotificationBannerDismissed(value: boolean) {
  if (value) localStorage.setItem(NOTIFICATION_BANNER_DISMISSED_KEY, "true");
  else localStorage.removeItem(NOTIFICATION_BANNER_DISMISSED_KEY);
}
```

```tsx
// ReminderMonitor.tsx (core behavior excerpt)
const { settings } = useUserSettings();

const dueAt = combineDateKeyAndTime(todo.dueDateKey, todo.dueTime);
const triggerAt = computeReminderTriggerAt(dueAt, settings.reminderLeadMinutes);

if (triggerAt <= now && !firedRef.current.has(key)) {
  const canShowInApp = settings.inAppReminderNotifications;
  const canShowBrowser = settings.browserReminderNotifications && typeof Notification !== "undefined" && Notification.permission === "granted";

  if (!canShowInApp && !canShowBrowser) continue;

  firedRef.current.add(key);
  dispatch({ type: "todo/mark-fired", todoId: todo.id, timestamp: Date.now() });

  if (canShowInApp) {
    dispatch({ type: "toast/add", toast: { id: randomId(), createdAt: Date.now(), title: todo.title, kind: "reminder", tone: "warning", todoId: todo.id } });
  }

  if (canShowBrowser && (document.hidden || !canShowInApp)) {
    new Notification("Reminder", { body: todo.title, icon: "/favicon.ico", tag: `omanote-reminder-${todo.id}` });
  }
}
```

```tsx
// ToastHost.tsx (snooze + duration excerpt)
const { settings } = useUserSettings();
const reminderToastTimeoutMs = settings.reminderToastDurationSeconds * 1000;

dispatch({ type: "todo/snooze", todoId: toast.todoId!, minutes: settings.defaultSnoozeMinutes });
```

```tsx
// NotificationPermissionBanner.tsx (visibility guard excerpt)
const { settings } = useUserSettings();
if (!settings.browserReminderNotifications) return null;
```

- [ ] **Step 4: Re-run tests and typecheck**

Run: `npm run test -- src/lib/reminder-schedule.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reminder-schedule.ts src/lib/reminder-schedule.test.ts src/lib/notification-permission.ts src/components/ReminderMonitor.tsx src/components/ToastHost.tsx src/components/NotificationPermissionBanner.tsx src/screens/SettingsScreen.tsx
git commit -m "feat: add notification settings with lead-time, snooze, and duration controls"
```

---

### Task 8: Add Security Controls (Change Passphrase + Recovery Download in Settings)

**Files:**
- Create: `src/lib/passphrase-form.ts`
- Test: `src/lib/passphrase-form.test.ts`
- Modify: `src/contexts/EncryptionContext.tsx`
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Write failing tests for passphrase form validation**

```ts
// src/lib/passphrase-form.test.ts
import { describe, expect, it } from "vitest";
import { validatePassphraseChange } from "./passphrase-form";

describe("validatePassphraseChange", () => {
  it("rejects when new and confirm do not match", () => {
    const result = validatePassphraseChange({ current: "old", next: "newpass", confirm: "newpass2" });
    expect(result.ok).toBe(false);
  });

  it("accepts valid input", () => {
    const result = validatePassphraseChange({ current: "old", next: "newpass123", confirm: "newpass123" });
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/lib/passphrase-form.test.ts`
Expected: FAIL due missing module.

- [ ] **Step 3: Implement passphrase-change API in encryption context and wire settings UI**

```ts
// src/lib/passphrase-form.ts
export function validatePassphraseChange(input: { current: string; next: string; confirm: string }) {
  if (!input.current.trim()) return { ok: false as const, message: "Current passphrase is required." };
  if (!input.next.trim()) return { ok: false as const, message: "New passphrase is required." };
  if (input.next.length < 8) return { ok: false as const, message: "New passphrase must be at least 8 characters." };
  if (input.next !== input.confirm) return { ok: false as const, message: "New passphrase and confirmation must match." };
  return { ok: true as const };
}
```

```ts
// EncryptionContext.tsx (new API)
const changePassphrase = useCallback(async (currentPassphrase: string, nextPassphrase: string) => {
  setError(null);
  if (!keyRecord?.wrappedKey) throw new Error("No encryption key found.");

  const currentWrappingKey = await deriveWrappingKey(currentPassphrase, keyRecord.salt);
  const verifiedContentKey = await unwrapContentKey(keyRecord.wrappedKey, currentWrappingKey);

  const nextSalt = generateSalt();
  const nextWrappingKey = await deriveWrappingKey(nextPassphrase, nextSalt);
  const nextWrappedKey = await wrapContentKey(verifiedContentKey, nextWrappingKey);

  await saveKey({ wrappedKey: nextWrappedKey, salt: nextSalt });
  keyRef.current = verifiedContentKey;
}, [keyRecord, saveKey]);
```

```tsx
// SettingsScreen.tsx (Security section excerpt)
<button
  className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
  onClick={() => void submitPassphraseChange()}
>
  Change passphrase
</button>

<button
  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
  onClick={() => void exportRecoveryKeyText()}
>
  Download Recovery Key (.txt)
</button>
```

- [ ] **Step 4: Re-run tests and typecheck**

Run: `npm run test -- src/lib/passphrase-form.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/passphrase-form.ts src/lib/passphrase-form.test.ts src/contexts/EncryptionContext.tsx src/screens/SettingsScreen.tsx
git commit -m "feat: add passphrase change and recovery key controls in settings"
```

---

### Task 9: Move Data Tools and Add Account Deletion Flow

**Files:**
- Create: `convex/account.ts`
- Test: `convex/account.test.ts`
- Modify: `src/app/auth/AuthContext.tsx`
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/components/layout/BottomNav.tsx`
- Modify: `src/components/layout/TopBar.tsx`

- [ ] **Step 1: Write failing Convex test for user data deletion mutation**

```ts
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("account.deleteMyData", () => {
  it("deletes user-owned documents", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.userSettings.upsertMySettings, { saveShortcut: "enter" });
    await t.mutation(api.account.deleteMyData, {});

    const settings = await t.query(api.userSettings.getMySettings, {});
    expect(settings).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- convex/account.test.ts`
Expected: FAIL because `api.account.deleteMyData` is missing.

- [ ] **Step 3: Implement account mutation, auth delete action, settings UI, and remove old profile menu actions**

```ts
// convex/account.ts
import { mutation } from "./_generated/server";
import { requireUserId } from "./utils";

export const deleteMyData = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    for await (const row of ctx.db.query("todos").withIndex("by_user_createdAt", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("todoChecklistItems").withIndex("by_user_todoId_position", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("canvasArtifacts").withIndex("by_user_artifact", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("canvasPlacements").withIndex("by_user_artifactType_artifactId", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("notes").withIndex("by_user_createdAt", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("noteFolders").withIndex("by_user_createdAt", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("bookmarks").withIndex("by_user_createdAt", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("bookmarkCategories").withIndex("by_user_createdAt", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("eventEntries").withIndex("by_user_createdAt", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("habitDefinitions").withIndex("by_user_createdAt", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("userHashtags").withIndex("by_user_createdAt", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("hashtagUsages").withIndex("by_user_hashtagName", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("activityHistory").withIndex("by_user_timestamp", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }

    const enc = await ctx.db.query("userEncryptionKeys").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (enc) await ctx.db.delete(enc._id);

    const settings = await ctx.db.query("userSettings").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (settings) await ctx.db.delete(settings._id);

    return { ok: true };
  },
});
```

```tsx
// AuthContext.tsx (excerpt)
interface AuthContextValue {
  user: { id: string; name: string; email: string; imageUrl: string | null; provider: "clerk" } | null;
  signOut: () => void;
  deleteAccount: () => Promise<void>;
}

deleteAccount: async () => {
  if (!user) throw new Error("No authenticated user");
  await user.delete();
},
```

```tsx
// SettingsScreen.tsx (Data + Account excerpts)
const [exportOpen, setExportOpen] = useState(false);
const [importOpen, setImportOpen] = useState(false);

<button onClick={() => setExportOpen(true)}>Export Data</button>
<button onClick={() => setImportOpen(true)}>Import Data</button>

<button
  className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white"
  onClick={() => void confirmDeleteAccount()}
>
  Delete account
</button>

{exportOpen ? <ExportDataModal onClose={() => setExportOpen(false)} /> : null}
{importOpen ? <ImportDataModal onClose={() => setImportOpen(false)} /> : null}
```

```tsx
// BottomNav.tsx + TopBar.tsx
// Remove Export Data, Import Data, and Download Recovery Key actions from profile menu.
// Keep only: Settings, Changelog & Roadmap, Logout.
```

Run: `npx convex codegen`

- [ ] **Step 4: Re-run account test + typecheck**

Run: `npm run test -- convex/account.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/account.ts convex/account.test.ts convex/_generated/api.d.ts convex/_generated/api.js src/app/auth/AuthContext.tsx src/screens/SettingsScreen.tsx src/components/layout/BottomNav.tsx src/components/layout/TopBar.tsx
git commit -m "feat: move data tools to settings and add account deletion flow"
```

---

### Task 10: Final Verification and Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add failing documentation check (missing settings feature notes)**

```md
# README validation target
- Must mention `/settings` page availability
- Must mention configurable save/newline shortcuts
- Must mention notification lead/snooze/duration controls
- Must mention passphrase change and account deletion path
```

- [ ] **Step 2: Run full verification suite before doc update**

Run: `npm run test`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS with production bundle output.

- [ ] **Step 3: Update README with settings features and moved actions**

```md
## Current state (additions)
- Settings page now includes grouped Editor, Notifications, Security, Data, and Account preferences.
- Save and newline shortcuts are configurable, with conflict validation.
- Browser/in-app reminder settings, lead time, default snooze, and reminder toast duration are configurable.
- Recovery key download, data export/import, and passphrase change are available from Settings.
- Account deletion is available from Settings and removes user data before account removal.
```

- [ ] **Step 4: Re-run build to verify docs-only change did not regress CI scripts**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document settings personalization and account controls"
```

---

## Self-Review

### 1. Spec Coverage Check
- Change passphrase: covered in **Task 8**.
- Save shortcut customization + newline configuration + conflict flagging: covered in **Task 5** and **Task 6**.
- Show/hide save help text globally: covered in **Task 6**.
- Browser/system notification settings + dismissed-banner recovery: covered in **Task 7**.
- Reminder lead timing (exact/5/10/15 early): covered in **Task 7**.
- Default snooze time: covered in **Task 7**.
- Notification duration: covered in **Task 7**.
- Delete account: covered in **Task 9**.
- Move export/import to settings: covered in **Task 9**.
- Move recovery key download to settings: covered in **Task 8** and **Task 9**.
- Group settings into categories: covered in **Task 4** and completed in later tasks.

### 2. Placeholder Scan
- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task includes concrete file paths, commands, and expected outcomes.

### 3. Type/Signature Consistency
- `UserSettings` keys are consistent across utilities, context, Convex schema, and settings screen.
- Shortcut types (`SaveShortcut`, `NewlineShortcut`) are reused across tests and runtime code.
- Reminder settings keys are consistent across settings UI and runtime consumers.
