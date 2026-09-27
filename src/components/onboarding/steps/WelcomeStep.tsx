import { ArrowRight } from "lucide-react";
import { ONBOARDING_GOAL_OPTIONS } from "../../../../convex/lib/surveyQuestions";
import { useUserSettings } from "../../../contexts/UserSettingsContext";
import { Button, OptionCard } from "../../ui";
import { OnboardingFooter, staggerStyle } from "../OnboardingChrome";

/**
 * Step 0 — welcome, plus one optional, skippable "what are you here for"
 * chip-select. Captured at signup rather than in the survey (which only
 * fires 3+ days in) so there's a JTBD signal at the moment of highest
 * intent — see docs/casestudy-omanote.md, Decision 6. Reuses the survey's
 * `use_cases` option set (ONBOARDING_GOAL_OPTIONS) so the two never drift.
 *
 * It's the first thing a new account sees, so it builds itself as a stack
 * (logo, heading, question, chips, Continue) rather than appearing at once.
 */
export function WelcomeStep({ onNext }: { onNext: () => void }) {
  const { settings, updateSettings } = useUserSettings();

  function toggleGoal(value: string) {
    const next = settings.onboardingGoals.includes(value)
      ? settings.onboardingGoals.filter((g) => g !== value)
      : [...settings.onboardingGoals, value];
    void updateSettings({ onboardingGoals: next });
  }

  return (
    <>
      {/* Same header block as OnboardingStepHeader, written out for the stagger. */}
      <div className="omanote-wizard-header flex flex-col items-center text-center">
        <h1 style={staggerStyle(1)} className="omanote-stagger-in text-2xl font-black text-app-ink">
          Welcome to omanote
        </h1>
        <p style={staggerStyle(2)} className="omanote-stagger-in mt-2 text-sm leading-6 text-app-ink-muted">
          Glad you're here. Let's get your space set up just the way you like it — it only takes a minute.
        </p>
      </div>

      <div className="omanote-wizard-body mt-6 space-y-2">
        <p style={staggerStyle(3)} className="omanote-stagger-in text-center text-xs font-medium text-app-ink-faint">
          What are you hoping to use omanote for? <span className="opacity-70">(optional)</span>
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {ONBOARDING_GOAL_OPTIONS.map((option, i) => (
            <OptionCard
              key={option.value}
              selected={settings.onboardingGoals.includes(option.value)}
              onClick={() => toggleGoal(option.value)}
              style={staggerStyle(4 + i * 0.5)}
              className="omanote-stagger-in px-3 py-1.5 text-xs"
            >
              {option.label}
            </OptionCard>
          ))}
        </div>
      </div>

      <OnboardingFooter>
        <span />
        <Button
          type="button"
          style={staggerStyle(4 + ONBOARDING_GOAL_OPTIONS.length * 0.5 + 0.5)}
          className="omanote-stagger-in gap-1.5"
          onClick={onNext}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </OnboardingFooter>
    </>
  );
}
