import { Fragment, type MouseEvent, type ReactNode } from "react";
import { Pencil, Pin, PinOff, Share2, Trash2 } from "lucide-react";
import { folderColorStyle } from "../../lib/folder-color";
import { cn } from "../ui";
import { FolderTab, type FolderTabEditing } from "./FolderTab";
import type { GalleryFolder } from "./types";

/** Rows a folder card shows before collapsing the rest into "+N more". */
export const FOLDER_CARD_ROW_LIMIT = 3;

/** One entry of the footer's "·"-separated line. `emphasis` (Public) uses the darker ink. */
export type FolderMeta = { label: string; emphasis?: boolean };

/** The folder's actions, shown as an icon strip over the tab row (desktop, on hover). */
export type FolderCardActions = {
  pinned: boolean;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
};

export type FolderGalleryCardProps = {
  name: string;
  icon?: string;
  color?: string;
  onOpen: () => void;
  onIconClick?: (anchor: HTMLButtonElement) => void;
  editing?: FolderTabEditing;
  /** Edit / share / delete / pin. Omitted for folders the user can't manage. */
  actions?: FolderCardActions;
  /** Items in the folder, as a pill beside the name. */
  count?: number;
  /** Already-sliced rows, at most FOLDER_CARD_ROW_LIMIT. */
  rows: ReactNode[];
  /** Items in the folder that the card could list; drives "+N more". */
  totalCount: number;
  emptyLabel: string;
  meta: FolderMeta[];
  /** Right side of the footer (the todo progress bar). */
  footerAside?: ReactNode;
};

const INTERACTIVE = "a, button, input, textarea, select, [role='button'], [role='checkbox'], [role='menu']";

/** The footer's standard entry for a folder: Public, in the darker ink. (Pinned shows as the pin action.) */
export function folderStatusMeta(folder: Pick<GalleryFolder, "shared">): FolderMeta[] {
  return folder.shared ? [{ label: "Public", emphasis: true }] : [];
}

const ACTION_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink";
/** Hidden until the card is hovered or holds focus; always shown where there's no hover. */
const REVEAL_CLASS =
  "opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 [@media(hover:none)]:opacity-100";

/**
 * Edit, share, delete, pin — absolutely positioned over the right end of the
 * tab row, so a long folder name keeps its full width and the strip sits on
 * top of it. Desktop only: on phones these live in the folder's own header.
 * A pinned folder's pin stays visible without hover; it is the pinned status.
 */
function FolderCardActionStrip({ name, actions }: { name: string; actions: FolderCardActions }) {
  const items = [
    { label: `Edit ${name}`, icon: Pencil, onClick: actions.onEdit, always: false },
    { label: `Share ${name}`, icon: Share2, onClick: actions.onShare, always: false },
    { label: `Delete ${name}`, icon: Trash2, onClick: actions.onDelete, always: false },
    {
      label: `${actions.pinned ? "Unpin" : "Pin"} ${name}`,
      icon: actions.pinned ? PinOff : Pin,
      onClick: actions.onTogglePin,
      always: actions.pinned,
    },
  ];
  return (
    <div
      data-testid="folder-card-actions"
      className="absolute bottom-0.5 right-0 hidden items-center gap-0.5 rounded-md p-0.5 transition-[background-color,box-shadow] group-hover/card:bg-app-surface-raised group-hover/card:shadow-soft group-focus-within/card:bg-app-surface-raised lg:flex"
    >
      {items.map(({ label, icon: Icon, onClick, always }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          data-reveal={always ? "always" : "hover"}
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          className={cn(ACTION_CLASS, always ? "bg-app-surface-raised text-app-ink" : REVEAL_CLASS)}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

/**
 * A folder in the Todos / Notes / Bookmarks gallery: the canvas folder tab
 * (with its item count) on a body bordered in the tab's colour, the action
 * strip over the tab row, item rows, and a footer of metadata (plus the todo
 * progress bar). Type-specific content arrives
 * through `rows`, `meta` and `footerAside`.
 *
 * Not a <button>: rows hold checkboxes and links, and interactive content
 * inside a button is invalid. The tab's name is the real button; a click on
 * the body that didn't land on a control forwards to it.
 */
export function FolderGalleryCard({
  name,
  icon,
  color,
  onOpen,
  onIconClick,
  editing,
  actions,
  count,
  rows,
  totalCount,
  emptyLabel,
  meta,
  footerAside,
}: FolderGalleryCardProps) {
  const more = totalCount - rows.length;
  const palette = folderColorStyle(color);
  const handleBodyClick = (event: MouseEvent<HTMLDivElement>) => {
    if (editing) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    onOpen();
  };

  return (
    <div className="group/card flex min-w-0 flex-col">
      {/* The action strip overlays the row's right end (so revealing it never
          shifts the tab); on desktop the tab stops short of it so a long name
          truncates instead of running under the icons. */}
      <div data-testid="folder-card-tab-row" className={cn("relative flex min-w-0 items-end", actions && !editing && "lg:pr-32")}>
        <FolderTab name={name} icon={icon} color={color} onOpen={onOpen} onIconClick={onIconClick} editing={editing} count={count} />
        {actions && !editing ? <FolderCardActionStrip name={name} actions={actions} /> : null}
      </div>
      <div
        data-testid="folder-card-body"
        onClick={handleBodyClick}
        // Fixed height, so every card in the grid lines up: three rows,
        // "+N more", and the footer.
        className={cn(
          "raised-shadow flex h-40 flex-col gap-3 overflow-hidden rounded-app-card rounded-tl-none border bg-app-surface-raised p-4 transition-[background-color] duration-app-base ease-app-in-out",
          palette ? undefined : "border-app-line",
          editing ? undefined : "cursor-pointer hover:bg-app-surface-hover",
        )}
        style={palette ? { borderColor: palette.surface } : undefined}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
          {rows.length ? rows : <p className="text-sm text-app-ink-faint">{emptyLabel}</p>}
          {more > 0 ? <p className="text-xs text-app-ink-faint">+{more.toLocaleString("en-US")} more</p> : null}
        </div>
        <div data-testid="folder-card-footer" className="flex min-w-0 items-center justify-between gap-3">
          <p data-testid="folder-card-meta" className="min-w-0 truncate text-xs">
            {meta.map((entry, index) => (
              <Fragment key={entry.label}>
                {index > 0 ? <span className="text-app-ink-faint"> · </span> : null}
                <span className={entry.emphasis ? "text-app-ink" : "text-app-ink-faint"}>{entry.label}</span>
              </Fragment>
            ))}
          </p>
          {footerAside}
        </div>
      </div>
    </div>
  );
}
