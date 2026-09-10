import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
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

export function UserSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const serverSettings = useQuery(api.userSettings.getMySettings);
  const upsertMySettings = useMutation(api.userSettings.upsertMySettings);

  const settings = useMemo(
    () => normalizeUserSettings(serverSettings),
    [serverSettings],
  );
  const loading = serverSettings === undefined;

  const updateSettings = useCallback(
    async (updates: UserSettingsPatch) => {
      if (serverSettings === undefined) {
        throw new Error(
          "Cannot update user settings before settings finish loading",
        );
      }
      await upsertMySettings(updates);
    },
    [serverSettings, upsertMySettings],
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
