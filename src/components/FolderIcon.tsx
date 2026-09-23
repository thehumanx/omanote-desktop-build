import { Folder, FolderOpen } from "lucide-react";
import { cn } from "./ui";

/**
 * A folder that opens and closes, built from Lucide's own `Folder` and
 * `FolderOpen` rather than hand-drawn geometry.
 *
 * The two glyphs are structurally different paths — `FolderOpen` is drawn in
 * perspective — so they can't be morphed into each other. They're stacked and
 * crossfaded with a small scale instead. At the 16px this renders at in the
 * feed, that reads the same as a morph would, and it costs nothing: both
 * icons are already in the bundle, both inherit `currentColor` (so dark mode
 * and every ink token keep working), and there's no new dependency.
 *
 * A bespoke hinged-flap SVG was tried first and dropped — see the design
 * system CHANGELOG for 2026-09-22. Lottie was considered and rejected too:
 * a player per icon is heavy for a 16px glyph that repeats down a list, and
 * Lottie bakes its colors in, which breaks theming.
 */
export function FolderIcon({
  open = false,
  className,
  strokeWidth = 2,
}: {
  /** Open in create/edit mode; closed when saved or merely being viewed. */
  open?: boolean;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    // Sized by the caller (`h-4 w-4`); the inner span is what the two stacked
    // glyphs position against, so a caller passing its own `position` utility
    // can't knock them loose.
    <span aria-hidden="true" className={cn("inline-block shrink-0", className)}>
      <span className="relative block h-full w-full">
        <Folder
          strokeWidth={strokeWidth}
          data-shown={open ? "false" : "true"}
          className="omanote-folder-glyph absolute inset-0 h-full w-full"
        />
        <FolderOpen
          strokeWidth={strokeWidth}
          data-shown={open ? "true" : "false"}
          className="omanote-folder-glyph absolute inset-0 h-full w-full"
        />
      </span>
    </span>
  );
}
