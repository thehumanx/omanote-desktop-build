import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { jsonCodec, readLocalStorage, writeLocalStorage } from "../lib/local-storage";
import {
  normalizeUserSettings,
  type UserSettings,
  type UserSettingsPatch,
} from "../lib/user-settings";

interface UserSettingsContextValue {
  settings: UserSettings;
  loading: boolean;
  updateSettings: (updates: UserSettingsPatch) => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

// Both per-user (see USER_SCOPED_KEYS in lib/local-storage.ts) and cleared on
// sign-out. Settings are display preferences, not content, so caching them
// unencrypted is fine.
const SETTINGS_CACHE_KEY = "omanote.user-settings-cache";
const SETTINGS_PENDING_KEY = "omanote.user-settings-pending";
const recordCodec = jsonCodec((value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value),
);

/**
 * Local-first settings.
 *
 * Settings used to be read straight from `getMySettings` and written straight
 * to `upsertMySettings`. Offline that failed twice over: after a reload the
 * query never answered, so the app fell back to defaults (theme, font and nav
 * style visibly changed) and every `updateSettings` threw "before settings
 * finish loading"; and a change made offline pended in Convex's in-memory
 * queue, lost on reload.
 *
 * Now the last server copy is cached, unsent changes live in a pending patch,
 * and what the app sees is always cache/server + pending. The patch is sent
 * when online (and on reconnect); a field leaves it only once the server has
 * confirmed that exact value.
 */
export function UserSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const serverSettings = useQuery(api.userSettings.getMySettings);
  const upsertMySettings = useMutation(api.userSettings.upsertMySettings);

  const [cached, setCached] = useState<Record<string, unknown> | null>(() =>
    readLocalStorage(SETTINGS_CACHE_KEY, recordCodec, null),
  );
  const [pending, setPending] = useState<UserSettingsPatch>(
    () => readLocalStorage(SETTINGS_PENDING_KEY, recordCodec, {}) as UserSettingsPatch,
  );
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    if (!serverSettings) return;
    writeLocalStorage(SETTINGS_CACHE_KEY, recordCodec, serverSettings as Record<string, unknown>);
    setCached(serverSettings as Record<string, unknown>);
  }, [serverSettings]);

  const commitPending = useCallback((next: UserSettingsPatch) => {
    pendingRef.current = next;
    writeLocalStorage(SETTINGS_PENDING_KEY, recordCodec, next as Record<string, unknown>);
    setPending(next);
  }, []);

  const flushingRef = useRef<Promise<void> | null>(null);
  const flush = useCallback((): Promise<void> => {
    if (flushingRef.current) return flushingRef.current;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve();
    const snapshot = pendingRef.current;
    if (Object.keys(snapshot).length === 0) return Promise.resolve();

    const clearConfirmed = () => {
      // Only the fields still holding the value that was sent: a change made
      // while this request was in flight stays pending for the next flush.
      const rest = { ...pendingRef.current } as Record<string, unknown>;
      for (const [key, value] of Object.entries(snapshot)) {
        if (JSON.stringify(rest[key]) === JSON.stringify(value)) delete rest[key];
      }
      commitPending(rest as UserSettingsPatch);
    };

    flushingRef.current = upsertMySettings(snapshot)
      .then(clearConfirmed, (error: unknown) => {
        // Reached the server and was refused: retrying can't help, so drop it
        // (the UI falls back to the server value) and let the caller report it.
        // Lost the connection instead: keep it for the reconnect flush.
        if (typeof navigator === "undefined" || navigator.onLine) {
          clearConfirmed();
          throw error;
        }
      })
      .finally(() => {
        flushingRef.current = null;
      });
    return flushingRef.current;
  }, [upsertMySettings, commitPending]);

  // Send anything left over from a previous offline session, and anything
  // queued while offline in this one.
  useEffect(() => {
    if (serverSettings === undefined) return;
    void flush().catch(() => {});
    const onOnline = () => void flush().catch(() => {});
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [serverSettings, flush]);

  const base = serverSettings ?? cached;
  const settings = useMemo(
    () => normalizeUserSettings({ ...(base ?? {}), ...pending } as Record<string, unknown>),
    [base, pending],
  );
  const loading = serverSettings === undefined && cached === null;

  const updateSettings = useCallback(
    async (updates: UserSettingsPatch) => {
      if (loading) {
        throw new Error(
          "Cannot update user settings before settings finish loading",
        );
      }
      commitPending({ ...pendingRef.current, ...updates });
      await flush();
    },
    [loading, commitPending, flush],
  );

  const value = useMemo<UserSettingsContextValue>(
    () => ({
      settings,
      loading,
      updateSettings,
    }),
    [loading, settings, updateSettings],
  );

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

/**
 * Settings without a backend, for surfaces that render real app components
 * outside the authenticated tree — the landing page's canvas preview, mainly.
 *
 * `normalizeUserSettings(undefined)` yields the same defaults a brand-new
 * account gets, so the preview shows the stock experience. `updateSettings`
 * resolves without doing anything: nothing in a read-only preview should be
 * mutating settings, and throwing here would turn a stray click into a crash
 * on the marketing page.
 */
export function StaticUserSettingsProvider({
  children,
  settings: overrides,
}: {
  children: React.ReactNode;
  settings?: Parameters<typeof normalizeUserSettings>[0];
}) {
  const value = useMemo<UserSettingsContextValue>(
    () => ({
      settings: normalizeUserSettings(overrides),
      loading: false,
      updateSettings: async () => {},
    }),
    [overrides],
  );

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings(): UserSettingsContextValue {
  const value = useContext(UserSettingsContext);
  if (!value) {
    throw new Error(
      "useUserSettings must be used inside UserSettingsProvider",
    );
  }
  return value;
}
