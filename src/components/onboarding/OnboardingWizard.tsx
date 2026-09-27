import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import { OnboardingShell, OnboardingStepExitingContext } from "./OnboardingChrome";
import { WelcomeStep } from "./steps/WelcomeStep";
import { MakeItYoursStep } from "./steps/MakeItYoursStep";
import { ConnectEnableStep } from "./steps/ConnectEnableStep";
import { GuideFeedbackStep } from "./steps/GuideFeedbackStep";
import { PassphraseStep } from "./steps/PassphraseStep";
import { AppLoadingScreen, cn } from "../ui";

const STEP_COUNT = 5;

/** How long the outgoing step stays mounted: its exit animation in index.css. */
const STEP_EXIT_MS = 240;

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
  const [hasNavigated, setHasNavigated] = useState(false);
  // The step animating out, kept mounted beside the new one for STEP_EXIT_MS.
  // A timer, not animationend: under reduced motion there's no animation, so
  // the event would never fire.
  const [leaving, setLeaving] = useState<number | null>(null);

  useEffect(() => {
    if (leaving === null) return;
    const timer = window.setTimeout(() => setLeaving(null), STEP_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  // Seed from the persisted resume marker once settings have loaded, rather
  // than always starting at step 0 — this is what lets a user land back on
  // step 2 (connect/enable) after the Google OAuth full-page redirect round trip.
  useEffect(() => {
    if (loading || index !== null) return;
    setIndex(settings.onboardingStep);
  }, [loading, index, settings.onboardingStep]);

  if (loading || index === null) return <AppLoadingScreen />;

  function goTo(nextIndex: number, dir: "next" | "prev") {
    if (nextIndex < 0 || nextIndex >= STEP_COUNT) return;
    setDirection(dir);
    setHasNavigated(true);
    setLeaving(index);
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

  function renderStep(step: number) {
    switch (step) {
      case 0:
        return <WelcomeStep onNext={() => goTo(1, "next")} />;
      case 1:
        return <MakeItYoursStep onNext={() => goTo(2, "next")} />;
      case 2:
        return <ConnectEnableStep onNext={() => goTo(3, "next")} onBack={() => goTo(1, "prev")} />;
      case 3:
        return <GuideFeedbackStep onNext={() => goTo(4, "next")} onBack={() => goTo(2, "prev")} />;
      default:
        return <PassphraseStep onBack={() => goTo(3, "prev")} onSubmitted={() => void handleComplete()} />;
    }
  }

  // Both steps share one grid cell, top-aligned, so their headers overlap
  // exactly: the title cross-fades in place while the bodies slide. Keyed by step, so the outgoing
  // step keeps its state (e.g. which config a carousel was on) while it leaves.
  return (
    <OnboardingShell>
      <div className="grid">
        {leaving !== null && leaving !== index ? (
          <div
            key={leaving}
            ref={(node) => node?.setAttribute("inert", "")}
            aria-hidden="true"
            className={cn(
              "pointer-events-none col-start-1 row-start-1",
              direction === "next" ? "omanote-wizard-page-out-next" : "omanote-wizard-page-out-prev",
            )}
          >
            <OnboardingStepExitingContext.Provider value={true}>{renderStep(leaving)}</OnboardingStepExitingContext.Provider>
          </div>
        ) : null}
        {/* The welcome step brings itself in as a stack on arrival, so the step
            slide would only blur it; the slide is for moving between steps. */}
        <div
          key={index}
          className={cn(
            "col-start-1 row-start-1",
            (hasNavigated || index !== 0) &&
              (direction === "next" ? "omanote-wizard-page-in-next" : "omanote-wizard-page-in-prev"),
          )}
        >
          {renderStep(index)}
        </div>
      </div>
    </OnboardingShell>
  );
}
