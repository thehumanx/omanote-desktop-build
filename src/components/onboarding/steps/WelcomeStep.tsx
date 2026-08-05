import { ArrowRight } from "lucide-react";
import { ONBOARDING_GOAL_OPTIONS } from "../../../../convex/lib/surveyQuestions";
import { useUserSettings } from "../../../contexts/UserSettingsContext";
import { Button, OptionCard } from "../../ui";
import { OnboardingFooter } from "../OnboardingChrome";

/**
 * Step 0 — welcome, plus one optional, skippable "what are you here for"
 * chip-select. Captured at signup rather than in the survey (which only
 * fires 3+ days in) so there's a JTBD signal at the moment of highest
 * intent — see docs/casestudy-omanote.md, Decision 6. Reuses the survey's
 * `use_cases` option set (ONBOARDING_GOAL_OPTIONS) so the two never drift.
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
      <div className="flex flex-col items-center text-center">
        <h1 className="text-2xl font-black text-app-ink">Welcome to omanote</h1>
        <p className="mt-2 text-sm leading-6 text-app-ink-muted">
          Glad you're here. Let's get your space set up just the way you like it — it only takes a minute.
        </p>
      </div>

      <div className="mt-6 space-y-2">
        <p className="text-center text-xs font-medium text-app-ink-faint">
          What are you hoping to use omanote for? <span className="opacity-70">(optional)</span>
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {ONBOARDING_GOAL_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              selected={settings.onboardingGoals.includes(option.value)}
              onClick={() => toggleGoal(option.value)}
              className="px-3 py-1.5 text-xs"
            >
              {option.label}
            </OptionCard>
          ))}
        </div>
      </div>

      <OnboardingFooter>
        <span />
        <Button type="button" className="gap-1.5" onClick={onNext}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </OnboardingFooter>
    </>
  );
}
