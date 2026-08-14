import { ArrowRight, X } from "lucide-react";
import { cn } from "../ui";

export type SurveyPromptStatus = "not-started" | "in-progress" | "completed";

interface SurveyPromptProps {
  status: SurveyPromptStatus;
  onTakeSurvey: () => void;
  /** Only used when status is "completed" — dismisses the thank-you row. */
  onDismiss?: () => void;
}

const STATUS_COPY: Record<SurveyPromptStatus, { label: string; body: string; dot: string }> = {
  "not-started": {
    label: "Quick survey",
    body: "Please help us improve omanote — it only takes a few minutes.",
    dot: "bg-info-solid",
  },
  "in-progress": {
    label: "Survey in progress",
    body: "Want to finish your survey? Your answers are saved — pick up right where you left off.",
    dot: "bg-warning-solid",
  },
  completed: {
    label: "Survey completed",
    body: "Thanks for sharing your feedback — it genuinely shapes what gets built next.",
    dot: "bg-success-solid",
  },
};

/**
 * One row within the shared "omanote updates" card (see CanvasSystemNotice).
 * Not-started/in-progress: whole row opens the survey, arrow reveals on
 * hover. Completed: a thank-you row that can be dismissed (X on hover)
 * instead of opening anything — it also disappears on its own next reload.
 */
export function SurveyPrompt({ status, onTakeSurvey, onDismiss }: SurveyPromptProps) {
  const { label, body, dot } = STATUS_COPY[status];
  const isCompleted = status === "completed";

  return (
    <div
      role={isCompleted ? undefined : "button"}
      tabIndex={isCompleted ? undefined : 0}
      onClick={isCompleted ? undefined : onTakeSurvey}
      onKeyDown={
        isCompleted
          ? undefined
          : (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onTakeSurvey();
              }
            }
      }
      aria-label="omanote survey invitation"
      className={cn(
        "group flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors duration-150",
        !isCompleted && "cursor-pointer hover:bg-app-surface-hover",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-sm text-app-ink-faint">
          <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
          {label}
        </span>
        <span className="text-sm text-app-ink-muted">{body}</span>
      </div>
      {isCompleted ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss?.();
          }}
          className="mt-0.5 shrink-0 text-app-ink-faint opacity-0 transition-opacity duration-150 hover:text-app-ink group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-app-ink-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      )}
    </div>
  );
}
