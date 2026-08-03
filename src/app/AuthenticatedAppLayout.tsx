import { AppProvider } from "./AppProvider";
import { AuthProvider } from "./auth/AuthContext";
import { EncryptionProvider } from "../contexts/EncryptionContext";
import { UserSettingsProvider } from "../contexts/UserSettingsContext";
import { EncryptionGate } from "../components/EncryptionGate";
import { DeviceActivityReporter } from "../components/DeviceActivityReporter";
import { UpdateProvider } from "../contexts/UpdateContext";
import { AppShell } from "../components/layout/AppShell";
import { ThemeProvider } from "../contexts/ThemeContext";
import { SeoHead } from "../seo/SeoHead";

export function AuthenticatedAppLayout() {
  return (
    <>
      <SeoHead noIndex />
      <AuthProvider>
      <UserSettingsProvider>
      <ThemeProvider>
      <EncryptionProvider>
        <EncryptionGate>
          <DeviceActivityReporter />
          <UpdateProvider>
            <AppProvider>
              <AppShell />
            </AppProvider>
          </UpdateProvider>
        </EncryptionGate>
      </EncryptionProvider>
      </ThemeProvider>
      </UserSettingsProvider>
    </AuthProvider>
    </>
  );
}
