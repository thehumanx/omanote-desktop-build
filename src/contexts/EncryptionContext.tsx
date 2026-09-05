import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  clearSessionContentKey,
  downloadRecoveryKeyTextFile,
  decryptBytes,
  decryptString,
  deriveWrappingKey,
  encryptBytes,
  encryptString,
  generateContentKey,
  generateRecoveryKey,
  generateSalt,
  isEncrypted,
  persistSessionContentKey,
  readSessionContentKey,
  unwrapContentKey,
  wrapContentKey,
} from "../lib/crypto";
import { DecryptionCache } from "../lib/decryption-cache";
import { friendlyErrorMessage } from "../lib/errors";
import { readLocalStorageOptional, stringCodec, writeLocalStorage } from "../lib/local-storage";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EncryptionContextValue {
  /**
   * null  = still loading (checking Convex for an existing key record)
   * false = no key exists — user must complete first-time setup
   * true  = key exists — user must enter their passphrase to unlock
   */
  isSetup: boolean | null;
  /** True while the decrypted key is not yet in memory. */
  isLocked: boolean;
  /** True while the provider is attempting to restore an unlocked key cache. */
  isRestoringSession: boolean;
  /**
   * True when the user unlocked via recovery key — they must set a new passphrase
   * before accessing the app so they don't need the recovery key every session.
   */
  needsPassphraseReset: boolean;
  /** Error message from the last failed setup / unlock attempt. */
  error: string | null;
  /** First-time setup: generate a key, wrap it, store in Convex. */
  setup: (passphrase: string) => Promise<void>;
  /** Per-session unlock: fetch wrapped key from Convex and unwrap it. */
  unlock: (passphrase: string) => Promise<void>;
  /** Unlock with a recovery key instead of a passphrase. */
  unlockWithRecoveryKey: (recoveryKey: string) => Promise<void>;
  /** Re-wrap the content key with a new passphrase after verifying the current passphrase. */
  changePassphrase: (currentPassphrase: string, nextPassphrase: string) => Promise<void>;
  /**
   * Set a brand-new passphrase without knowing the old one.
   * Only valid when `needsPassphraseReset` is true (i.e. after recovery-key unlock).
   */
  resetPassphrase: (newPassphrase: string) => Promise<void>;
  /** Generate and download a new recovery key text file. */
  exportRecoveryKeyText: () => Promise<void>;
  /** Clear the in-memory key (e.g. on sign-out). */
  lock: () => void;
  /** Encrypt a string. Throws if locked. */
  encrypt: (text: string) => Promise<string>;
  /** Decrypt a string. Passes through non-encrypted values unchanged. Throws if locked. */
  decrypt: (text: string) => Promise<string>;
  /** Convenience wrappers for optional fields. */
  encryptOptional: (text: string | undefined) => Promise<string | undefined>;
  decryptOptional: (text: string | undefined) => Promise<string | undefined>;
  /** Encrypt / decrypt every element of a string array. */
  encryptArray: (items: string[]) => Promise<string[]>;
  decryptArray: (items: string[]) => Promise<string[]>;
  /** Binary payloads (canvas images). Not cached — blobs are large and used once. */
  encryptBinary: (bytes: ArrayBuffer, mimeType: string) => Promise<ArrayBuffer>;
  decryptBinary: (payload: ArrayBuffer) => Promise<{ bytes: ArrayBuffer; mimeType: string }>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function encryptionSetupStorageKey(userSessionKey: string) {
  return `omanote.encryption-setup:${userSessionKey}`;
}

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useClerkAuth();
  // Raw wrapped-key record from Convex (null = not set up, undefined = loading).
  const keyRecord = useQuery(api.encryptionKeys.getKey);
  const saveKey = useMutation(api.encryptionKeys.saveKey);
  const userSessionKey = userId ? `clerk:${userId}` : null;
  const { isOffline } = useNetworkStatus();

  // The decrypted CryptoKey lives only in memory (never serialised).
  const keyRef = useRef<CryptoKey | null>(null);
  // Holds plaintext, so its lifetime is tied to the key's — see forgetContentKey.
  const decryptionCacheRef = useRef(new DecryptionCache());

  /**
   * The one way to drop the content key. Three separate paths need to do this
   * (sign-out, the key record disappearing, and an explicit `lock()`), and the
   * cache holds decrypted plaintext — so any path that forgets to clear it
   * would leave content readable after locking. Funnelling them through here
   * makes that impossible to get wrong.
   */
  const forgetContentKey = useCallback(() => {
    keyRef.current = null;
    decryptionCacheRef.current.clear();
  }, []);

  const [isLocked, setIsLocked] = useState(true);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [needsPassphraseReset, setNeedsPassphraseReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousUserSessionKeyRef = useRef<string | null>(null);
  const restoreAttemptedForRef = useRef<string | null>(null);

  // Derive isSetup from the Convex query state.
  // undefined → still loading → null (unless a cached "this device is set
  //             up" flag exists and we're offline — see below)
  // null      → no record    → false
  // object    → record found → true
  //
  // Convex can't confirm this with no network, so `keyRecord` stays
  // `undefined` forever offline. Without a fallback, a device that's already
  // set up would be stuck showing "loading" indefinitely instead of
  // proceeding to unlock from the locally cached content key. The flag only
  // unblocks this loading gate — actual decryption still requires either the
  // correct passphrase or an already-unlocked key restored from storage, so
  // this can't expose data on its own.
  const cachedIsSetup =
    isOffline && userSessionKey
      ? readLocalStorageOptional(encryptionSetupStorageKey(userSessionKey), stringCodec) === "true"
      : false;
  const isSetup: boolean | null =
    keyRecord === undefined ? (cachedIsSetup ? true : null) : keyRecord !== null;

  useEffect(() => {
    if (keyRecord && userSessionKey) {
      writeLocalStorage(encryptionSetupStorageKey(userSessionKey), stringCodec, "true");
    }
  }, [keyRecord, userSessionKey]);

  // When the user signs out, clear the cached key and lock in-memory state.
  useEffect(() => {
    if (!isSignedIn) {
      forgetContentKey();
      setIsLocked(true);
      setIsRestoringSession(false);
      setNeedsPassphraseReset(false);
      restoreAttemptedForRef.current = null;
      const previousSessionKey = previousUserSessionKeyRef.current;
      previousUserSessionKeyRef.current = null;
      if (previousSessionKey) {
        void clearSessionContentKey(previousSessionKey);
      }
      return;
    }
    previousUserSessionKeyRef.current = userSessionKey;
  }, [forgetContentKey, isSignedIn, userSessionKey]);

  // When the key record disappears, re-lock and clear the cached key.
  useEffect(() => {
    if (keyRecord === null) {
      forgetContentKey();
      setIsLocked(true);
      setIsRestoringSession(false);
      setNeedsPassphraseReset(false);
      restoreAttemptedForRef.current = null;
      if (userSessionKey) {
        void clearSessionContentKey(userSessionKey);
      }
    }
  }, [forgetContentKey, keyRecord, userSessionKey]);

  // Try to restore the unlocked key from browser storage to avoid re-prompting
  // on page reloads within the same signed-in browser session.
  useEffect(() => {
    if (isSetup !== true || !isLocked || !userSessionKey) {
      setIsRestoringSession(false);
      return;
    }
    if (restoreAttemptedForRef.current === userSessionKey) {
      return;
    }

    restoreAttemptedForRef.current = userSessionKey;
    setIsRestoringSession(true);
    let canceled = false;

    void (async () => {
      try {
        const cachedKey = await readSessionContentKey(userSessionKey);
        if (canceled || !cachedKey) return;
        if (!cachedKey.extractable) {
          void clearSessionContentKey(userSessionKey);
          return;
        }
        keyRef.current = cachedKey;
        setIsLocked(false);
        setError(null);
      } catch {
        if (!canceled) {
          void clearSessionContentKey(userSessionKey);
        }
      } finally {
        if (!canceled) {
          setIsRestoringSession(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [isSetup, isLocked, userSessionKey]);

  // ---------------------------------------------------------------------------
  // setup — first time only
  // ---------------------------------------------------------------------------
  const setup = useCallback(
    async (passphrase: string) => {
      setError(null);
      try {
        const salt = generateSalt();
        const contentKey = await generateContentKey();
        const wrappingKey = await deriveWrappingKey(passphrase, salt);
        const wrappedKey = await wrapContentKey(contentKey, wrappingKey);
        const recoveryKey = generateRecoveryKey();
        const recoverySalt = generateSalt();
        const recoveryWrappingKey = await deriveWrappingKey(recoveryKey, recoverySalt);
        const wrappedRecoveryKey = await wrapContentKey(contentKey, recoveryWrappingKey);
        await saveKey({ wrappedKey, salt, wrappedRecoveryKey, recoverySalt });
        // The only path that installs a *different* content key — the unlock
        // and recovery paths all re-install the same one, so their cached
        // entries stay valid. Clearing here keeps the cache's invariant simple:
        // it only ever holds plaintext for the key currently in keyRef.
        decryptionCacheRef.current.clear();
        keyRef.current = contentKey;
        if (userSessionKey && contentKey.extractable) {
          void persistSessionContentKey(userSessionKey, contentKey);
        }
        downloadRecoveryKeyTextFile(recoveryKey, userId ?? undefined);
        restoreAttemptedForRef.current = userSessionKey;
        setIsLocked(false);
      } catch (err) {
        const message = friendlyErrorMessage(err, "Could not finish encryption setup. Please try again.");
        setError(message);
        throw new Error(message);
      }
    },
    [saveKey, userSessionKey, userId],
  );

  // ---------------------------------------------------------------------------
  // unlock — every session
  // ---------------------------------------------------------------------------
  const unlock = useCallback(
    async (passphrase: string) => {
      setError(null);
      if (!keyRecord) {
        setError("No encryption key found. Please set up encryption first.");
        return;
      }
      try {
        const wrappingKey = await deriveWrappingKey(passphrase, keyRecord.salt);
        const contentKey = await unwrapContentKey(keyRecord.wrappedKey, wrappingKey);
        keyRef.current = contentKey;
        if (userSessionKey && contentKey.extractable) {
          void persistSessionContentKey(userSessionKey, contentKey);
        }
        restoreAttemptedForRef.current = userSessionKey;
        setIsLocked(false);
      } catch {
        const message = "Incorrect passphrase. Please try again.";
        setError(message);
        throw new Error(message);
      }
    },
    [keyRecord, userSessionKey],
  );

  // ---------------------------------------------------------------------------
  // unlock with recovery key
  // ---------------------------------------------------------------------------
  const unlockWithRecoveryKey = useCallback(
    async (recoveryKey: string) => {
      setError(null);
      if (!keyRecord?.wrappedRecoveryKey || !keyRecord.recoverySalt) {
        const message = "No recovery key is configured for this account yet.";
        setError(message);
        throw new Error(message);
      }
      try {
        const recoveryWrappingKey = await deriveWrappingKey(recoveryKey, keyRecord.recoverySalt);
        const contentKey = await unwrapContentKey(keyRecord.wrappedRecoveryKey, recoveryWrappingKey);
        keyRef.current = contentKey;
        if (userSessionKey && contentKey.extractable) {
          void persistSessionContentKey(userSessionKey, contentKey);
        }
        restoreAttemptedForRef.current = userSessionKey;
        setIsLocked(false);
        setNeedsPassphraseReset(true);
      } catch {
        const message = "Invalid recovery key. Please try again.";
        setError(message);
        throw new Error(message);
      }
    },
    [keyRecord, userSessionKey],
  );

  // ---------------------------------------------------------------------------
  // change passphrase
  // ---------------------------------------------------------------------------
  const changePassphrase = useCallback(
    async (currentPassphrase: string, nextPassphrase: string) => {
      setError(null);
      if (!keyRecord?.wrappedKey) {
        const message = "No encryption key found.";
        setError(message);
        throw new Error(message);
      }
      if (currentPassphrase === nextPassphrase) {
        const message = "New passphrase must be different from your current passphrase.";
        setError(message);
        throw new Error(message);
      }

      try {
        const currentWrappingKey = await deriveWrappingKey(currentPassphrase, keyRecord.salt);
        const verifiedContentKey = await unwrapContentKey(keyRecord.wrappedKey, currentWrappingKey);

        const nextSalt = generateSalt();
        const nextWrappingKey = await deriveWrappingKey(nextPassphrase, nextSalt);
        const nextWrappedKey = await wrapContentKey(verifiedContentKey, nextWrappingKey);

        // Also rotate the recovery key so the old one can no longer unlock data.
        const recoveryKey = generateRecoveryKey();
        const recoverySalt = generateSalt();
        const recoveryWrappingKey = await deriveWrappingKey(recoveryKey, recoverySalt);
        const wrappedRecoveryKey = await wrapContentKey(verifiedContentKey, recoveryWrappingKey);

        await saveKey({ wrappedKey: nextWrappedKey, salt: nextSalt, wrappedRecoveryKey, recoverySalt });
        downloadRecoveryKeyTextFile(recoveryKey, userId ?? undefined);
        keyRef.current = verifiedContentKey;
        if (userSessionKey && verifiedContentKey.extractable) {
          void persistSessionContentKey(userSessionKey, verifiedContentKey);
        }
      } catch {
        const message = "Incorrect current passphrase.";
        setError(message);
        throw new Error(message);
      }
    },
    [keyRecord, saveKey, userSessionKey],
  );

  // ---------------------------------------------------------------------------
  // reset passphrase — used after recovery-key unlock, no old passphrase needed
  // ---------------------------------------------------------------------------
  const resetPassphrase = useCallback(
    async (newPassphrase: string) => {
      setError(null);
      if (!keyRef.current) {
        const message = "No unlocked key available. Please unlock first.";
        setError(message);
        throw new Error(message);
      }
      if (!keyRef.current.extractable) {
        const message = "Please sign out, sign in again, then unlock with your recovery key before resetting.";
        setError(message);
        throw new Error(message);
      }
      try {
        const nextSalt = generateSalt();
        const nextWrappingKey = await deriveWrappingKey(newPassphrase, nextSalt);
        const nextWrappedKey = await wrapContentKey(keyRef.current, nextWrappingKey);

        const recoveryKey = generateRecoveryKey();
        const recoverySalt = generateSalt();
        const recoveryWrappingKey = await deriveWrappingKey(recoveryKey, recoverySalt);
        const wrappedRecoveryKey = await wrapContentKey(keyRef.current, recoveryWrappingKey);

        await saveKey({ wrappedKey: nextWrappedKey, salt: nextSalt, wrappedRecoveryKey, recoverySalt });
        downloadRecoveryKeyTextFile(recoveryKey, userId ?? undefined);
        if (userSessionKey && keyRef.current.extractable) {
          void persistSessionContentKey(userSessionKey, keyRef.current);
        }
        setNeedsPassphraseReset(false);
      } catch (err) {
        const message = friendlyErrorMessage(err, "Could not reset your passphrase. Please try again.");
        setError(message);
        throw new Error(message);
      }
    },
    [saveKey, userId, userSessionKey],
  );

  // ---------------------------------------------------------------------------
  // export / rotate recovery key
  // ---------------------------------------------------------------------------
  const exportRecoveryKeyText = useCallback(async () => {
    setError(null);
    if (!keyRef.current) {
      const message = "Unlock your notes first.";
      setError(message);
      throw new Error(message);
    }
    if (!keyRef.current.extractable) {
      if (userSessionKey) {
        void clearSessionContentKey(userSessionKey);
      }
      const message = "Please sign out, sign in again, then unlock once before exporting.";
      setError(message);
      throw new Error(message);
    }
    try {
      const recoveryKey = generateRecoveryKey();
      const recoverySalt = generateSalt();
      const recoveryWrappingKey = await deriveWrappingKey(recoveryKey, recoverySalt);
      const wrappedRecoveryKey = await wrapContentKey(keyRef.current, recoveryWrappingKey);
      await saveKey({ wrappedRecoveryKey, recoverySalt });
      downloadRecoveryKeyTextFile(recoveryKey, userId ?? undefined);
    } catch (err) {
      const message = friendlyErrorMessage(err, "Could not export a recovery key. Please try again.");
      setError(message);
      throw new Error(message);
    }
  }, [saveKey, userId, userSessionKey]);

  // ---------------------------------------------------------------------------
  // lock
  // ---------------------------------------------------------------------------
  const lock = useCallback(() => {
    forgetContentKey();
    setIsRestoringSession(false);
    restoreAttemptedForRef.current = null;
    if (userSessionKey) {
      void clearSessionContentKey(userSessionKey);
    }
    setIsLocked(true);
  }, [forgetContentKey, userSessionKey]);

  // ---------------------------------------------------------------------------
  // encrypt / decrypt helpers — stable refs, read key from ref internally
  // ---------------------------------------------------------------------------
  const encrypt = useCallback(async (text: string): Promise<string> => {
    if (!keyRef.current) throw new Error("Encryption key not available");
    return encryptString(text, keyRef.current);
  }, []);

  const decrypt = useCallback(async (text: string): Promise<string> => {
    const key = keyRef.current;
    if (!key) throw new Error("Encryption key not available");
    // Plaintext passthrough (pre-encryption rows) costs nothing to "decrypt",
    // so it skips the cache rather than taking up an entry.
    return decryptionCacheRef.current.resolve(text, (value) => decryptString(value, key), isEncrypted(text));
  }, []);

  const encryptOptional = useCallback(
    async (text: string | undefined): Promise<string | undefined> => {
      if (text === undefined) return undefined;
      return encrypt(text);
    },
    [encrypt],
  );

  const decryptOptional = useCallback(
    async (text: string | undefined): Promise<string | undefined> => {
      if (text === undefined) return undefined;
      return decrypt(text);
    },
    [decrypt],
  );

  const encryptArray = useCallback(
    async (items: string[]): Promise<string[]> => Promise.all(items.map(encrypt)),
    [encrypt],
  );

  const decryptArray = useCallback(
    async (items: string[]): Promise<string[]> => Promise.all(items.map(decrypt)),
    [decrypt],
  );

  // Deliberately not routed through DecryptionCache: that cache is keyed on the
  // ciphertext string and holds plaintext, which for images would mean keeping
  // multi-megabyte buffers alive for the session.
  const encryptBinary = useCallback(async (bytes: ArrayBuffer, mimeType: string): Promise<ArrayBuffer> => {
    if (!keyRef.current) throw new Error("Encryption key not available");
    return encryptBytes(bytes, mimeType, keyRef.current);
  }, []);

  const decryptBinary = useCallback(async (payload: ArrayBuffer) => {
    if (!keyRef.current) throw new Error("Encryption key not available");
    return decryptBytes(payload, keyRef.current);
  }, []);

  return (
    <EncryptionContext.Provider
      value={{
        isSetup,
        isLocked,
        isRestoringSession,
        needsPassphraseReset,
        error,
        setup,
        unlock,
        unlockWithRecoveryKey,
        changePassphrase,
        resetPassphrase,
        exportRecoveryKeyText,
        lock,
        encrypt,
        decrypt,
        encryptOptional,
        decryptOptional,
        encryptArray,
        decryptArray,
        encryptBinary,
        decryptBinary,
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEncryption(): EncryptionContextValue {
  const value = useContext(EncryptionContext);
  if (!value) throw new Error("useEncryption must be used inside EncryptionProvider");
  return value;
}
