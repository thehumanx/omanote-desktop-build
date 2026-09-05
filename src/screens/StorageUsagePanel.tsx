import { useMemo } from "react";
import { useQuery } from "convex/react";
import { FileText, Image as ImageIcon, Link2, StickyNote, CheckSquare, Clock } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useApp } from "../app/AppProvider";
import { formatBytes } from "../lib/format-bytes";

function utf8Bytes(value: string | undefined | null): number {
  if (!value) return 0;
  return new TextEncoder().encode(value).length;
}

function Row({
  icon: Icon,
  label,
  count,
  bytes,
}: {
  icon: typeof FileText;
  label: string;
  count: number;
  bytes: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-app-line py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-surface-muted text-app-ink-faint">
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate text-sm font-medium text-app-ink">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-4 text-sm text-app-ink-faint">
        <span className="tabular-nums">{count.toLocaleString()}</span>
        <span className="w-16 text-right tabular-nums">{formatBytes(bytes)}</span>
      </div>
    </div>
  );
}

/**
 * The 200MB cap made legible: what's using space, split by images (R2,
 * tracked by the page-images worker) vs text (Convex, tracked exactly by
 * every content mutation — see convex/storageUsage.ts). Lives inside
 * SettingsScreen as the "storage" category rather than its own route.
 *
 * The per-entity-type breakdown below is computed client-side from state
 * already in memory rather than a new server query — it's informational, not
 * the thing the cap is enforced against, so approximating it from what's
 * already loaded is enough.
 */
export function StorageUsagePanel({ isMobileDrawer = false }: { isMobileDrawer?: boolean }) {
  const { state } = useApp();
  const usage = useQuery(api.storageUsage.getUsage);

  const breakdown = useMemo(() => {
    const activePages = state.pages.filter((page) => !page.deletedAt);
    const activeNotes = state.notes.filter((note) => !note.deletedAt);
    const activeTodos = state.todos.filter((todo) => !todo.deletedAt);
    const activeBookmarks = state.bookmarks.filter((bookmark) => !bookmark.deletedAt);
    const activeEvents = state.events.filter((event) => !event.deletedAt);

    return [
      {
        key: "pages",
        icon: FileText,
        label: "Canvas pages",
        count: activePages.length,
        bytes: activePages.reduce((sum, p) => sum + utf8Bytes(p.docJson) + utf8Bytes(p.preview) + utf8Bytes(p.title), 0),
      },
      {
        key: "notes",
        icon: StickyNote,
        label: "Notes",
        count: activeNotes.length,
        bytes: activeNotes.reduce((sum, n) => sum + utf8Bytes(n.body) + utf8Bytes(n.title), 0),
      },
      {
        key: "todos",
        icon: CheckSquare,
        label: "Todos",
        count: activeTodos.length,
        bytes: activeTodos.reduce((sum, t) => sum + utf8Bytes(t.title) + utf8Bytes(t.notes), 0),
      },
      {
        key: "bookmarks",
        icon: Link2,
        label: "Saved links",
        count: activeBookmarks.length,
        bytes: activeBookmarks.reduce((sum, b) => sum + utf8Bytes(b.title) + utf8Bytes(b.description) + utf8Bytes(b.url), 0),
      },
      {
        key: "events",
        icon: Clock,
        label: "Reminders",
        count: activeEvents.length,
        bytes: activeEvents.reduce((sum, e) => sum + utf8Bytes(e.label) + utf8Bytes(e.notes), 0),
      },
    ];
  }, [state.pages, state.notes, state.todos, state.bookmarks, state.events]);

  const usedBytes = usage ? usage.textBytes + usage.imageBytes : 0;
  const percent = usage ? Math.min(100, (usedBytes / usage.capBytes) * 100) : 0;
  const nearCap = percent >= 90;

  return (
    <section className="space-y-6">
      {!isMobileDrawer ? <h2 className="text-lg font-bold text-app-ink">Storage</h2> : null}

      {usage ? (
        <div className="rounded-2xl border border-app-line bg-app-surface p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-2xl font-bold tabular-nums text-app-ink">{formatBytes(usedBytes)}</p>
            <p className="text-sm text-app-ink-faint">of {formatBytes(usage.capBytes)} used</p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-app-surface-muted">
            <div
              className={nearCap ? "h-full rounded-full bg-danger-solid" : "h-full rounded-full bg-app-ink"}
              style={{ width: `${Math.max(2, percent)}%` }}
            />
          </div>
          {nearCap ? (
            <p className="mt-3 text-xs font-medium text-danger-ink">
              You're close to the 200MB limit — delete something to free up space.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-app-line bg-app-surface p-4">
          <div className="flex items-center gap-2 text-app-ink-faint">
            <ImageIcon className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Images</span>
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums text-app-ink">{formatBytes(usage?.imageBytes ?? 0)}</p>
          <p className="text-xs text-app-ink-faint">{(usage?.imageCount ?? 0).toLocaleString()} image{usage?.imageCount === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-2xl border border-app-line bg-app-surface p-4">
          <div className="flex items-center gap-2 text-app-ink-faint">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Text</span>
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums text-app-ink">{formatBytes(usage?.textBytes ?? 0)}</p>
          <p className="text-xs text-app-ink-faint">
            {breakdown.reduce((sum, row) => sum + row.count, 0).toLocaleString()} items
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-app-line bg-app-surface px-4">
        <h3 className="pt-4 text-xs font-bold uppercase tracking-wide text-app-ink-faint">By type</h3>
        <div className="mt-1">
          {breakdown.map((row) => (
            <Row key={row.key} icon={row.icon} label={row.label} count={row.count} bytes={row.bytes} />
          ))}
        </div>
      </div>

      <p className="text-xs text-app-ink-faint">
        The "By type" sizes above are estimated from the plaintext on this device; the total up top counts the
        encrypted bytes actually stored, which run larger — that number is what the 200MB limit is measured
        against. Image totals come from the server and are exact either way.
      </p>
    </section>
  );
}
