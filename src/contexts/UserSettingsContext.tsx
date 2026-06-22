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

export function useUserSettings(): UserSettingsContextValue {
  const value = useContext(UserSettingsContext);
  if (!value) {
    throw new Error(
      "useUserSettings must be used inside UserSettingsProvider",
    );
  }
  return value;
}
