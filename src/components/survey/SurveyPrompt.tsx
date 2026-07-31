import { useEffect, useState } from "react";
import { Button } from "../ui";

interface SurveyPromptProps {
  onTakeSurvey: () => void;
  onNotNow: () => void;
  /** True once the user has answered at least one question but not submitted. */
  resuming: boolean;
}

/**
 * Deliberately unobtrusive: bottom-right card, no backdrop, no overlay, nothing
 * blocked. It sits above the bottom nav so it never covers navigation on mobile.
 */
export function SurveyPrompt({ onTakeSurvey, onNotNow, resuming }: SurveyPromptProps) {
  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setIsEntered(true);
      return;
    }

    // Slight delay so the card animates in after the page settles rather than
    // competing with the app's own mount transition.
    const timer = window.setTimeout(() => setIsEntered(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-app-toast flex justify-center px-4 sm:inset-x-auto sm:right-5 sm:justify-end sm:px-0"
      style={{ bottom: "calc(var(--omanote-bottom-nav-height, 64px) + 1rem)" }}
    >
      <div
        role="dialog"
        aria-label="omanote survey invitation"
        className={[
          "pointer-events-auto w-full max-w-[22rem] transform-gpu rounded-app-card border border-app-line bg-app-surface p-4 shadow-app-dialog transition-[transform,opacity] duration-app-slow ease-app-out",
          isEntered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        ].join(" ")}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-app-ink-faint">
          {resuming ? "Survey in progress" : "A small favour"}
        </p>
        <p className="mt-1.5 text-sm font-bold leading-snug text-app-ink">
          {resuming ? "Want to finish your survey?" : "Please help us improve omanote."}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-app-ink-muted">
          {resuming
            ? "Your answers are saved — pick up right where you left off."
            : "It only takes a few minutes, and it genuinely shapes what gets built next."}
        </p>
        <div className="mt-3.5 flex gap-2">
          <Button tone="default" className="flex-1 py-2 text-[13px]" onClick={onTakeSurvey}>
            {resuming ? "Continue" : "Take survey"}
          </Button>
          <Button tone="ghost" className="flex-1 py-2 text-[13px]" onClick={onNotNow}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
