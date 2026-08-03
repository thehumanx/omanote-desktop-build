import { useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useEncryption } from "../../../contexts/EncryptionContext";
import { Button } from "../../ui";
import { OnboardingFooter } from "../OnboardingChrome";

/** Final wizard step — sets up E2E encryption from a passphrase the user types themselves. */
export function PassphraseStep({ onBack, onSubmitted }: { onBack: () => void; onSubmitted: () => void }) {
  const { setup, error } = useEncryption();
  const [phrase, setPhrase] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEmpty = !phrase.trim();

  // Takes an optional form event so the native <form onSubmit> (Enter key in
  // the input) and the footer's Continue button — which is portaled outside
  // the <form> DOM subtree via OnboardingFooter, so it can't rely on
  // type="submit" — both call the same logic.
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (isEmpty) return;
    setLoading(true);
    try {
      await setup(phrase);
      // isSetup flips true inside setup(), so EncryptionGate will stop
      // rendering this wizard on the next render regardless — onSubmitted
      // just lets the wizard shell run its own completion bookkeeping
      // (marking onboardingCompleted) in the meantime.
      onSubmitted();
    } catch {
      // error is surfaced via the error prop from context
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <h1 className="text-2xl font-black text-app-ink">Lock it down</h1>
        <p className="mt-2 text-sm leading-6 text-app-ink-muted">
          omanote can not be truly privacy-first without your passphrase. Add a passphrase you'd
          not forget easily.
        </p>
      </div>

      <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-xs font-medium text-app-ink-muted" htmlFor="onboarding-passphrase">
            Passphrase
          </label>
          <div className="relative">
            <input
              id="onboarding-passphrase"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              className="w-full rounded-app-field border border-app-line bg-app-surface-muted px-3 py-2 pr-10 text-sm text-app-ink placeholder:text-app-ink-faint outline-none focus:border-app-line-strong focus:bg-app-surface"
              placeholder="Enter your passphrase…"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              disabled={loading}
              aria-label={visible ? "Hide passphrase" : "Show passphrase"}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-app-ink-faint transition hover:text-app-ink disabled:opacity-50"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <p className="rounded-lg bg-info-surface px-3 py-2 text-xs text-info-ink">
          We'll also download a recovery key file. Keep it safe so you can unlock your data if you
          forget your phrase.
        </p>

        {error && (
          <p className="rounded-lg bg-danger-surface px-3 py-2 text-xs text-danger-ink">{error}</p>
        )}

      </form>

      <OnboardingFooter>
        <Button type="button" tone="ghost" className="gap-1.5" onClick={onBack} disabled={loading}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={loading || isEmpty}>
          {loading ? "Please wait…" : "Save and download key"}
        </Button>
      </OnboardingFooter>
    </div>
  );
}
