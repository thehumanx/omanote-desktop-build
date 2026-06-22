import { useConvexAuth, useQuery } from 'convex/react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { api } from '../lib/api';
import { deriveWrappingKey, unwrapContentKey, decryptString, isEncrypted } from '../lib/crypto';

const PASSPHRASE_STORE_KEY = 'omanote_enc_passphrase';

type State =
  | { status: 'loading' }
  | { status: 'no_encryption' }
  | { status: 'locked'; hasSavedPassphrase: boolean }
  | { status: 'unlocked'; contentKey: CryptoKey };

type EncryptionContextType = {
  status: State['status'];
  hasBiometric: boolean;
  hasSavedPassphrase: boolean;
  /** Unlock with an explicit passphrase. Returns true on success. */
  unlock: (passphrase: string, saveForBiometric?: boolean) => Promise<boolean>;
  /** Unlock via biometric prompt — retrieves stored passphrase. */
  unlockWithBiometric: () => Promise<boolean>;
  lock: () => void;
  /** Decrypt a value; returns plaintext, or the original value if not encrypted or key unavailable. */
  decrypt: (value: string) => Promise<string>;
};

const EncryptionContext = createContext<EncryptionContextType | null>(null);

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  // Skip the query entirely until Clerk has provided a valid auth token to Convex.
  // Without this guard Convex throws "Unauthorized" on every app start.
  const encKeyRecord = useQuery(
    api.encryptionKeys.getKey,
    isAuthenticated ? {} : 'skip',
  );
  const [state, setState] = useState<State>({ status: 'loading' });
  const [hasBiometric, setHasBiometric] = useState(false);
  const [hasSavedPassphrase, setHasSavedPassphrase] = useState(false);
  const initialized = useRef(false);

  // While not authenticated yet, stay in loading state
  if (!isAuthenticated && state.status === 'loading') {
    // no-op — keep spinner until auth is ready
  }

  // Initialize once encKeyRecord loads (only runs when authenticated)
  if (!initialized.current && isAuthenticated && encKeyRecord !== undefined) {
    initialized.current = true;
    if (encKeyRecord === null) {
      setState({ status: 'no_encryption' });
    } else {
      Promise.all([
        LocalAuthentication.isEnrolledAsync(),
        SecureStore.getItemAsync(PASSPHRASE_STORE_KEY),
      ]).then(([enrolled, saved]) => {
        setHasBiometric(enrolled);
        const hasSaved = saved !== null;
        setHasSavedPassphrase(hasSaved);
        setState({ status: 'locked', hasSavedPassphrase: hasSaved });
      });
    }
  }

  const unlock = useCallback(
    async (passphrase: string, saveForBiometric = false): Promise<boolean> => {
      if (!encKeyRecord) return false;
      try {
        console.log('[Encryption] subtle available:', typeof crypto?.subtle);
        console.log('[Encryption] salt length:', encKeyRecord.salt?.length);
        console.log('[Encryption] wrappedKey length:', encKeyRecord.wrappedKey?.length);
        const wrappingKey = await deriveWrappingKey(passphrase, encKeyRecord.salt);
        console.log('[Encryption] wrappingKey derived OK');
        const contentKey = await unwrapContentKey(encKeyRecord.wrappedKey, wrappingKey);
        console.log('[Encryption] contentKey unwrapped OK');
        if (saveForBiometric) {
          await SecureStore.setItemAsync(PASSPHRASE_STORE_KEY, passphrase);
          setHasSavedPassphrase(true);
        }
        setState({ status: 'unlocked', contentKey });
        return true;
      } catch (e: any) {
        console.error('[Encryption] unlock failed:', e?.name, e?.message, e);
        return false;
      }
    },
    [encKeyRecord],
  );

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Omanote',
      fallbackLabel: 'Use passphrase',
      cancelLabel: 'Cancel',
    });
    if (!result.success) return false;
    const passphrase = await SecureStore.getItemAsync(PASSPHRASE_STORE_KEY);
    if (!passphrase) return false;
    return unlock(passphrase);
  }, [unlock]);

  const lock = useCallback(() => {
    setState({ status: 'locked', hasSavedPassphrase });
  }, [hasSavedPassphrase]);

  const decrypt = useCallback(
    async (value: string): Promise<string> => {
      if (!isEncrypted(value)) return value;
      if (state.status !== 'unlocked') return value;
      try {
        return await decryptString(value, state.contentKey);
      } catch {
        return value;
      }
    },
    [state],
  );

  return (
    <EncryptionContext.Provider
      value={{
        status: state.status,
        hasBiometric,
        hasSavedPassphrase,
        unlock,
        unlockWithBiometric,
        lock,
        decrypt,
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption(): EncryptionContextType {
  const ctx = useContext(EncryptionContext);
  if (!ctx) throw new Error('useEncryption must be used inside EncryptionProvider');
  return ctx;
}
