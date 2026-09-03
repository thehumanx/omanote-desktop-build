import { AppProvider } from "./AppProvider";
import { AuthProvider } from "./auth/AuthContext";
import { EncryptionProvider } from "../contexts/EncryptionContext";
import { UserSettingsProvider } from "../contexts/UserSettingsContext";
import { EncryptionGate } from "../components/EncryptionGate";
import { DomainGate } from "../components/DomainGate";
import { LocalCacheGate } from "../components/LocalCacheGate";
import { DeviceActivityReporter } from "../components/DeviceActivityReporter";
import { ErrorReporter } from "../components/ErrorReporter";
import { UpdateProvider } from "../contexts/UpdateContext";
import { AppShell } from "../components/layout/AppShell";
import { ThemeProvider } from "../contexts/ThemeContext";

export function AuthenticatedAppLayout() {
  return (
    <>
      <AuthProvider>
      <DomainGate>
      <LocalCacheGate>
      <UserSettingsProvider>
      <ThemeProvider>
      <EncryptionProvider>
        <EncryptionGate>
          <DeviceActivityReporter />
          <ErrorReporter />
          <UpdateProvider>
            <AppProvider>
              <AppShell />
            </AppProvider>
          </UpdateProvider>
        </EncryptionGate>
      </EncryptionProvider>
      </ThemeProvider>
      </UserSettingsProvider>
      </LocalCacheGate>
      </DomainGate>
    </AuthProvider>
    </>
  );
}
