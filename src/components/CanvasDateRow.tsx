import { ChevronDown, X } from "lucide-react";

export function formatTodayLabel(date: Date): string {
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.toLocaleDateString("en-US", { day: "numeric" });
  return `Today · ${month} ${day}`;
}

export type CanvasDateRowProps = {
  label: string;
  /** "enter" shows a chevron that opens /history; "exit" shows a close icon that returns to /canvas. */
  mode: "enter" | "exit";
  onToggle: () => void;
};

/**
 * The small label row injected into the shared top bar by Canvas (today's
 * date, mode "enter") and History (mode "exit"). Both routes render it in
 * the same spot, so moving between them reads as one control flipping state
 * rather than a page swap.
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
