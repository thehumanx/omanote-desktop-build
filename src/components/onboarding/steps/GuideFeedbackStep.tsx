import { ArrowLeft, ArrowRight, BookOpen, MessageSquare } from "lucide-react";
import { Button } from "../../ui";
import { OnboardingFooter } from "../OnboardingChrome";

/**
 * Step 3 — purely informational, no interaction beyond Back/Continue. Not a
 * link to /guide: EncryptionGate gates every route while isSetup is false,
 * so navigating there mid-wizard would just show this wizard again at that
 * URL instead. This tells the user where to find help later, once they're
 * actually inside the app.
 */
export function GuideFeedbackStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <h1 className="text-2xl font-black text-app-ink">Need a hand later?</h1>
        <p className="mt-2 text-sm leading-6 text-app-ink-muted">
          Two things worth knowing before you dive in.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <div className="rounded-app-panel border border-app-line bg-app-surface p-4">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-app-ink-faint" />
            <div>
              <p className="text-sm font-bold text-app-ink">Something confusing?</p>
              <p className="mt-1 text-xs leading-relaxed text-app-ink-muted">
                The Guide covers every feature — find it anytime from your profile menu.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-app-panel border border-app-line bg-app-surface p-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-app-ink-faint" />
            <div>
              <p className="text-sm font-bold text-app-ink">Got an idea or a bug?</p>
              <p className="mt-1 text-xs leading-relaxed text-app-ink-muted">
                Send feedback or a feature request from your profile menu — I read every one.
              </p>
            </div>
          </div>
        </div>
      </div>

      <OnboardingFooter>
        <Button type="button" tone="ghost" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button type="button" className="gap-1.5" onClick={onNext}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </OnboardingFooter>
    </div>
  );
}
