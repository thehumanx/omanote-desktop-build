import { useEffect, useState } from 'react';
import { isEncrypted } from '../lib/crypto';
import { useEncryption } from '../contexts/EncryptionContext';

/**
 * Decrypts a single string reactively.
 * Returns the plaintext once unlocked, an empty string while loading,
 * or the original value if it isn't encrypted.
 */
export function useDecrypt(value: string | undefined, fallback = ''): string {
  const { decrypt, status } = useEncryption();

  const initial = value
    ? isEncrypted(value)
      ? status === 'unlocked' ? '' : fallback
      : value
    : fallback;

  const [text, setText] = useState(initial);

  useEffect(() => {
    if (!value) {
      setText(fallback);
      return;
    }
    if (!isEncrypted(value)) {
      setText(value);
      return;
    }
    if (status !== 'unlocked') {
      setText(fallback);
      return;
    }
    let cancelled = false;
    decrypt(value).then((result) => {
      if (!cancelled) setText(result);
    });
    return () => {
      cancelled = true;
    };
  }, [value, status, decrypt, fallback]);

  return text;
}

/**
 * Decrypts multiple strings in one hook call.
 * Returns them in the same order, decrypted once unlocked.
 */
export function useDecryptMany(values: (string | undefined)[]): string[] {
  const { decrypt, status } = useEncryption();
  const [texts, setTexts] = useState<string[]>(
    values.map((v) => (v && !isEncrypted(v) ? v : '')),
  );

  useEffect(() => {
    if (status !== 'unlocked') {
      setTexts(values.map((v) => (v && !isEncrypted(v) ? v : '')));
      return;
    }
    let cancelled = false;
    Promise.all(values.map((v) => (v ? decrypt(v) : Promise.resolve('')))).then(
      (results) => {
        if (!cancelled) setTexts(results);
      },
    );
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ...values]);

  return texts;
}
