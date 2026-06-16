export interface PassphraseChangeInput {
  current: string;
  next: string;
  confirm: string;
}

export type PassphraseValidationResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
    };

export function validatePassphraseChange(input: PassphraseChangeInput): PassphraseValidationResult {
  if (!input.current.trim()) {
    return { ok: false, message: "Current passphrase is required." };
  }
  if (!input.next.trim()) {
    return { ok: false, message: "New passphrase is required." };
  }
  if (input.next.length < 8) {
    return { ok: false, message: "New passphrase must be at least 8 characters." };
  }
  if (input.next !== input.confirm) {
    return { ok: false, message: "New passphrase and confirmation must match." };
  }
  if (input.current === input.next) {
    return { ok: false, message: "New passphrase must be different from your current passphrase." };
  }
  return { ok: true };
}
