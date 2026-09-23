import { CategoryIconView } from "../lib/bookmark-category-icon";
import { folderColorStyle } from "../lib/folder-color";
import { FolderIcon } from "./FolderIcon";
import { cn } from "./ui";

/**
 * The folder line under a group of artifacts in the day feed. Deliberately
 * quiet — it names where the content landed, it isn't a heading for it.
 *
 * A folder that has been given its own icon or emoji shows that instead, via
 * the same `CategoryIconView` the folder nav and todo rows use, so one folder
 * doesn't look like two different things in two places. Those are static: an
 * emoji has no open state, and animating an arbitrary Lucide glyph by
 * crossfading it with an open folder would just look like a bug. Only the
 * default folder animates, and only when `open` is passed.
 */
export function FolderLabel({
  name,
  icon,
  color,
  open,
  className,
}: {
  name: string;
  /** The folder's own icon: a Lucide icon name or an emoji. */
  icon?: string;
  /** The folder's colour key; tints this tab and, for a drawn glyph, the icon. */
  color?: string;
  open?: boolean;
  className?: string;
}) {
  const palette = folderColorStyle(color);
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-sm", palette ? undefined : "text-app-ink-faint", className)}
      style={palette ? { backgroundColor: palette.surface, color: palette.ink } : undefined}
    >
      {icon ? (
        <CategoryIconView icon={icon} size="sm" className="shrink-0" color={color} />
      ) : (
        // The default folder is drawn in `currentColor`, which the tint above
        // has already set — no separate ink needed.
        <FolderIcon open={open} strokeWidth={1.75} className="h-4 w-4" />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}
