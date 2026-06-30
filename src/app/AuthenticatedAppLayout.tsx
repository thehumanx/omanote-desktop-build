import { AppProvider } from "./AppProvider";
import { AuthProvider } from "./auth/AuthContext";
import { EncryptionProvider } from "../contexts/EncryptionContext";
import { UserSettingsProvider, useUserSettings } from "../contexts/UserSettingsContext";
import { EncryptionGate } from "../components/EncryptionGate";
import { DeviceActivityReporter } from "../components/DeviceActivityReporter";
import { UpdateProvider } from "../contexts/UpdateContext";
import { AppShell } from "../components/layout/AppShell";
import { ThemeProvider } from "../contexts/ThemeContext";
import { SeoHead } from "../seo/SeoHead";

function ThemedAuthenticatedApp() {
  const { settings, loading, updateSettings } = useUserSettings();

  return (
    <ThemeProvider settings={settings} loading={loading} updateSettings={updateSettings}>
      <UpdateProvider>
        <AppProvider>
          <AppShell />
        </AppProvider>
      </UpdateProvider>
    </ThemeProvider>
  );
}

export function AuthenticatedAppLayout() {
  return (
    <>
      <SeoHead noIndex />
      <AuthProvider>
      <EncryptionProvider>
        <EncryptionGate>
          <DeviceActivityReporter />
          <UserSettingsProvider>
            <ThemedAuthenticatedApp />
          </UserSettingsProvider>
        </EncryptionGate>
      </EncryptionProvider>
    </AuthProvider>
    </>
  );
}
