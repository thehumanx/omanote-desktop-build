import React, { useState } from "react";
import { useEncryption } from "../contexts/EncryptionContext";
import { Button } from "./ui";

// ---------------------------------------------------------------------------
// Shared form layout
// ---------------------------------------------------------------------------

function PassphraseForm({
  heading,
  description,
  confirmLabel,
  requireConfirm,
  secretLabel,
  secretPlaceholder,
  secretAutoComplete,
  onSubmit,
  error,
}: {
  heading: string;
  description: React.ReactNode;
  confirmLabel: string;
  requireConfirm: boolean;
  secretLabel?: string;
  secretPlaceholder?: string;
  secretAutoComplete?: string;
  onSubmit: (passphrase: string) => Promise<void>;
  error: string | null;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const displayError = localError ?? error;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!passphrase.trim()) {
      setLocalError("Passphrase cannot be empty.");
      return;
    }
    if (requireConfirm && passphrase !== confirm) {
      setLocalError("Passphrases do not match.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(passphrase);
    } catch {
      // error is surfaced via the error prop from context
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-canvas px-4">
      <div className="w-full max-w-md rounded-xl border border-app-line bg-app-surface p-6 shadow-app-soft">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-app-ink-faint">omanote</p>
        <h1 className="mt-2 text-2xl font-black text-app-ink">{heading}</h1>
        <p className="mt-2 text-sm leading-6 text-app-ink-muted">{description}</p>

        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-app-ink-muted" htmlFor="passphrase">
              {secretLabel ?? "Encryption passphrase"}
            </label>
            <input
              id="passphrase"
              type="password"
              autoComplete={secretAutoComplete ?? (requireConfirm ? "new-password" : "current-password")}
              autoFocus
              className="w-full rounded-app-field border border-app-line bg-app-surface-muted px-3 py-2 text-sm text-app-ink placeholder:text-app-ink-faint outline-none focus:border-app-line-strong focus:bg-app-surface"
              placeholder={secretPlaceholder ?? "Enter your passphrase…"}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              disabled={loading}
            />
          </div>

          {requireConfirm && (
            <div>
              <label className="mb-1 block text-xs font-medium text-app-ink-muted" htmlFor="confirm">
                Confirm passphrase
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                className="w-full rounded-app-field border border-app-line bg-app-surface-muted px-3 py-2 text-sm text-app-ink placeholder:text-app-ink-faint outline-none focus:border-app-line-strong focus:bg-app-surface"
                placeholder="Repeat your passphrase…"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          {displayError && (
            <p className="rounded-lg bg-danger-surface px-3 py-2 text-xs text-danger-ink">{displayError}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : confirmLabel}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup screen (first time)
// ---------------------------------------------------------------------------

function SetupScreen() {
  const { setup, error } = useEncryption();
  return (
    <PassphraseForm
      heading="Protect your notes"
      description={
        <>
          Choose an <strong>encryption passphrase</strong>. Your notes, todos, bookmarks, and
          events will be encrypted with this passphrase before being stored. Even the server
          cannot read them.{" "}
          <span className="text-danger-ink">
            We will also download a recovery key file. Keep it safe so you can unlock data if you
            forget your passphrase.
          </span>
        </>
      }
      confirmLabel="Enable encryption"
      requireConfirm
      secretLabel="Encryption passphrase"
      secretPlaceholder="Choose your passphrase…"
      onSubmit={setup}
      error={error}
    />
  );
}

// ---------------------------------------------------------------------------
// Unlock screen (every session)
// ---------------------------------------------------------------------------

function UnlockScreen() {
  const { unlock, unlockWithRecoveryKey, error } = useEncryption();
  const [mode, setMode] = useState<"passphrase" | "recovery">("passphrase");

  if (mode === "recovery") {
    return (
      <div>
        <PassphraseForm
          heading="Unlock with recovery key"
          description="Enter your recovery key from the exported .txt file."
          confirmLabel="Unlock"
          requireConfirm={false}
          secretLabel="Recovery key"
          secretPlaceholder="Enter your recovery key…"
          secretAutoComplete="off"
          onSubmit={unlockWithRecoveryKey}
          error={error}
        />
        <div className="-mt-16 flex justify-center px-4 pb-8">
          <button
            type="button"
            className="text-xs text-app-ink-muted underline underline-offset-2 transition hover:text-app-ink"
            onClick={() => setMode("passphrase")}
          >
            Use passphrase instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PassphraseForm
        heading="Unlock your notes"
        description="Enter your encryption passphrase to decrypt your data for this session."
        confirmLabel="Unlock"
        requireConfirm={false}
        secretLabel="Encryption passphrase"
        secretPlaceholder="Enter your passphrase…"
        onSubmit={unlock}
        error={error}
      />
      <div className="-mt-16 flex justify-center px-4 pb-8">
        <button
          type="button"
          className="text-xs text-app-ink-muted underline underline-offset-2 transition hover:text-app-ink"
          onClick={() => setMode("recovery")}
        >
          Use recovery key instead
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reset passphrase screen (shown after recovery-key unlock)
// ---------------------------------------------------------------------------

function ResetPassphraseScreen() {
  const { resetPassphrase, error } = useEncryption();
  return (
    <PassphraseForm
      heading="Set a new passphrase"
      description={
        <>
          You unlocked using your recovery key.{" "}
          <strong>Please set a new passphrase</strong> so you don't need your recovery key every
          time you sign in. A new recovery key file will be downloaded — keep it somewhere safe.
        </>
      }
      confirmLabel="Save new passphrase"
      requireConfirm
      secretLabel="New passphrase"
      secretPlaceholder="Choose a new passphrase…"
      onSubmit={resetPassphrase}
      error={error}
    />
  );
}

// ---------------------------------------------------------------------------
// Loading screen
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-canvas">
      <div className="text-sm text-app-ink-faint">Loading…</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate — renders children only when unlocked
// ---------------------------------------------------------------------------

export function EncryptionGate({ children }: { children: React.ReactNode }) {
  const { isSetup, isLocked, isRestoringSession, needsPassphraseReset } = useEncryption();

  if (isSetup === null || isRestoringSession) return <LoadingScreen />;
  if (!isSetup) return <SetupScreen />;
  if (isLocked) return <UnlockScreen />;
  if (needsPassphraseReset) return <ResetPassphraseScreen />;
  return <>{children}</>;
}
