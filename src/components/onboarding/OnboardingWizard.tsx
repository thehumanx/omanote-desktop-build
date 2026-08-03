import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import { OnboardingShell } from "./OnboardingChrome";
import { WelcomeStep } from "./steps/WelcomeStep";
import { MakeItYoursStep } from "./steps/MakeItYoursStep";
import { ConnectEnableStep } from "./steps/ConnectEnableStep";
import { GuideFeedbackStep } from "./steps/GuideFeedbackStep";
import { PassphraseStep } from "./steps/PassphraseStep";

const STEP_COUNT = 5;

function LoadingCard() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-canvas">
      <div className="text-sm text-app-ink-faint">Loading…</div>
    </div>
  );
}

/**
 * Replaces the old `SetupScreen` as `EncryptionGate`'s first-run view. Shown
 * once per account: welcome → customize → connect/enable (skippable) →
 * guide/feedback pointers → encryption passphrase last, framed as "one more
 * thing" instead of the first thing a new user sees.
 *
 * Full-screen, not a `BaseModal` — the passphrase step is mandatory (there's
 * no dismiss that leaves the user inside the app without encryption set up),
 * so this sidesteps `BaseModal`'s universal Escape-to-close rather than
 * fighting it.
 */
export function OnboardingWizard() {
  const { settings, loading, updateSettings } = useUserSettings();
  const navigate = useNavigate();
  const [index, setIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  // Seed from the persisted resume marker once settings have loaded, rather
  // than always starting at step 0 — this is what lets a user land back on
  // step 2 (connect/enable) after the Google OAuth full-page redirect round trip.
  useEffect(() => {
    if (loading || index !== null) return;
    setIndex(settings.onboardingStep);
  }, [loading, index, settings.onboardingStep]);

  if (loading || index === null) return <LoadingCard />;

  function goTo(nextIndex: number, dir: "next" | "prev") {
    if (nextIndex < 0 || nextIndex >= STEP_COUNT) return;
    setDirection(dir);
    setIndex(nextIndex);
    // Persist on every transition, including back to step 0 — otherwise a
    // user who navigates back and then closes the app resumes on whatever
    // step they last moved *forward* to, not where they actually left off.
    void updateSettings({ onboardingStep: nextIndex as 0 | 1 | 2 | 3 | 4 });
  }

  async function handleComplete() {
    // isSetup flips true inside PassphraseStep's own `setup()` call, at
    // which point EncryptionGate stops rendering this wizard at all — this
    // is bookkeeping for the resume marker, not the gate itself. The
    // reveal-in fade the user sees on arrival is handled by EncryptionGate
    // itself, not here.
    //
    // founderNoteSeen deliberately stays false here — AppShell's own
    // auto-open effect is what shows the founder note once the canvas
    // mounts, so completing the wizard is what triggers it, not a manual
    // dismissal here.
    //
    // The explicit navigate matters when this step was reached via the
    // Google OAuth redirect: the browser is still sitting at whatever URL
    // that redirect landed on (e.g. /settings?google=connected), and
    // nothing else would ever move it away from that once the gate opens.
    navigate("/canvas", { replace: true });
    await updateSettings({ onboardingCompleted: true });
  }

  return (
    <OnboardingShell>
      <div
        key={index}
        className={direction === "next" ? "omanote-wizard-step-next" : "omanote-wizard-step-prev"}
      >
        {index === 0 && <WelcomeStep onNext={() => goTo(1, "next")} />}
        {index === 1 && <MakeItYoursStep onNext={() => goTo(2, "next")} />}
        {index === 2 && <ConnectEnableStep onNext={() => goTo(3, "next")} onBack={() => goTo(1, "prev")} />}
        {index === 3 && <GuideFeedbackStep onNext={() => goTo(4, "next")} onBack={() => goTo(2, "prev")} />}
        {index === 4 && (
          <PassphraseStep onBack={() => goTo(3, "prev")} onSubmitted={() => void handleComplete()} />
        )}
      </div>
    </OnboardingShell>
  );
}
