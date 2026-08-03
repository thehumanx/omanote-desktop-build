import React, { useState } from "react";
import { useEncryption } from "../contexts/EncryptionContext";
import { OnboardingWizard } from "./onboarding/OnboardingWizard";
import { OnboardingLogoReveal } from "./onboarding/OnboardingLogoReveal";
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

  // Tracks the *previous* render's isSetup so we can tell "just finished the
  // onboarding wizard" apart from "isSetup was already true on every other
  // page load" — only the former gets the logo reveal + fade-in below.
  //
  // Both pieces of state are updated during render (React's documented
  // "adjust state while rendering" pattern — see
  // react.dev/reference/react/useState#storing-information-from-previous-renders)
  // rather than via a ref mutated mid-render plus a useEffect: a ref written
  // during render doesn't survive React StrictMode's double-render in dev
  // (the throwaway render already clobbers it before the committed render
  // reads it), and driving the phase change from an effect adds a one-frame
  // flash of the bare app before the logo reveal appears. Updating both
  // during render keeps everything resolved within the same render pass.
  const [prevIsSetup, setPrevIsSetup] = useState(isSetup);
  const [postOnboardingPhase, setPostOnboardingPhase] = useState<"logo" | "reveal" | null>(null);
  if (prevIsSetup !== isSetup) {
    if (prevIsSetup === false && isSetup === true) setPostOnboardingPhase("logo");
    setPrevIsSetup(isSetup);
  }

  if (isSetup === null || isRestoringSession) return <LoadingScreen />;
  if (!isSetup) return <OnboardingWizard />;
  if (isLocked) return <UnlockScreen />;
  if (needsPassphraseReset) return <ResetPassphraseScreen />;
  if (postOnboardingPhase === "logo") {
    return <OnboardingLogoReveal onDone={() => setPostOnboardingPhase("reveal")} />;
  }
  if (postOnboardingPhase === "reveal") return <div className="omanote-onboarding-reveal">{children}</div>;
  return <>{children}</>;
}
