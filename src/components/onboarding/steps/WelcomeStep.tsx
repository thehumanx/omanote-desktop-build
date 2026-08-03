import { ArrowRight } from "lucide-react";
import { Button } from "../../ui";
import { OnboardingFooter } from "../OnboardingChrome";

/** Step 0 — a minimal, no-decisions-required landing before the wizard proper starts. */
export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div className="flex flex-col items-center text-center">
        <h1 className="text-2xl font-black text-app-ink">Welcome to omanote</h1>
        <p className="mt-2 text-sm leading-6 text-app-ink-muted">
          Glad you're here. Let's get your space set up just the way you like it — it only takes a minute.
        </p>
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
