import { ChevronDown, X } from "lucide-react";

export function formatTodayLabel(date: Date): string {
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.toLocaleDateString("en-US", { day: "numeric" });
  return `Today · ${month} ${day}`;
}

export type CanvasDateRowProps = {
  label: string;
  /** "enter" shows an always-visible chevron that opens history mode; "exit" shows an always-visible close icon that returns to today. */
  mode: "enter" | "exit";
  onToggle: () => void;
};

/**
 * The small date label row shown above both the canvas (today, mode "enter")
 * and the in-place history view (mode "exit") of the canvas page. Toggling
 * between the two is local state — no navigation — so the history view
 * grows directly out of this exact spot with no route-transition seam.
 */
export function CanvasDateRow({ label, mode, onToggle }: CanvasDateRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={mode === "enter" ? "View history" : "Close history"}
      className="group flex w-full items-center justify-center gap-3 text-app-ink md:justify-start"
    >
      <span className="text-sm font-bold">{label}</span>
      <span className="flex items-center text-app-ink-faint transition-colors duration-150 group-hover:text-app-ink">
        {mode === "enter" ? <ChevronDown className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </span>
    </button>
  );
}
