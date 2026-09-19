import { Pin } from "lucide-react";
import { cn } from "../ui";

/**
 * The pin toggle for a canvas, shared by `PageCard` and
 * `CanvasContinueWriting` — the two surfaces that render a canvas as a card.
 *
 * One icon, two states, per the design: a plain stroked pin when the canvas
 * isn't pinned and the same pin filled in when it is. That reads as a single
 * control changing state, which `Pin`/`PinOff` (two different glyphs) would
 * not.
 */
export function PagePinButton({
  pinned,
  onToggle,
  /**
   * Whether a pinned canvas keeps its button visible when the card isn't
   * hovered. True on the "Continue writing" shelf, where pinning is what put
   * the card there and the badge reads as a standing state; false in the day
   * feed, where pinning only affects a *different* section and a persistent
   * badge would be noise.
   */
  persistWhenPinned = false,
  size = "md",
  className,
}: {
  pinned?: boolean;
  onToggle: () => void;
  persistWhenPinned?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const hoverOnly = "opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <button
      type="button"
      aria-label={pinned ? "unpin canvas" : "pin canvas"}
      aria-pressed={pinned ?? false}
      title={pinned ? "Unpin" : "Pin"}
      onClick={onToggle}
      className={cn(
        "rounded-full p-1 transition hover:bg-app-surface-hover",
        pinned ? "text-app-ink" : "text-app-line-strong hover:text-app-ink-muted",
        pinned && persistWhenPinned ? "" : hoverOnly,
        className,
      )}
    >
      <Pin className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", pinned && "fill-current")} />
    </button>
  );
}
