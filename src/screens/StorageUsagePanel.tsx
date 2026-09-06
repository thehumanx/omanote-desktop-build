import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/react";
import { FileText, Image as ImageIcon, Link2, StickyNote, CheckSquare, Clock, RefreshCw } from "lucide-react";
import { randomId } from "@omanote/shared";
import { api } from "../../convex/_generated/api";
import { useApp } from "../app/AppProvider";
import { formatBytes } from "../lib/format-bytes";
import { reconcileImageUsage } from "../lib/page-images";

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
 * The 200MB cap made legible: what's using space, split by images (R2 canvas
 * images + Convex-storage share thumbnails, both tracked exactly server-side)
 * vs text (Convex, tracked exactly by every content mutation — see
 * convex/storageUsage.ts). Lives inside SettingsScreen as the "storage"
 * category rather than its own route.
 *
 * The per-text-type rows in "By type" are estimated client-side from state
 * already in memory rather than a new server query — informational, not what
 * the cap is enforced against, so approximating from what's already loaded is
 * enough. The two image rows there are exact server totals, same source as
 * the summary tiles above.
 */
export function StorageUsagePanel({ isMobileDrawer = false }: { isMobileDrawer?: boolean }) {
  const { state, dispatch } = useApp();
  const { getToken } = useAuth();
  const usage = useQuery(api.storageUsage.getUsage);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // The image counter is a mirror of R2, kept in sync by best-effort reports
  // from the page-images worker (see convex/storageUsage.ts) — it can drift
  // low if a report is ever lost. This recomputes it from R2 itself rather
  // than trusting the running total.
  const recalculateImageUsage = async () => {
    setIsRecalculating(true);
    try {
      await reconcileImageUsage(() => getToken({ template: "convex" }));
      dispatch({
        type: "toast/add",
        toast: { id: randomId(), createdAt: Date.now(), title: "Image storage recalculated" },
      });
    } catch {
      dispatch({
        type: "toast/add",
        toast: { id: randomId(), createdAt: Date.now(), title: "Couldn't recalculate image storage", tone: "warning" },
      });
    } finally {
      setIsRecalculating(false);
    }
  };

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

  // Exact, server-sourced rows — unlike `breakdown` above, which estimates
  // from plaintext already loaded on this device. Combined for the "By type"
  // list so it accounts for every image byte the 200MB cap is measured
  // against, not just the ones this device happens to have handy.
  const imageRows = [
    {
      key: "canvas-images",
      icon: ImageIcon,
      label: "Canvas images",
      count: usage?.imageCount ?? 0,
      bytes: usage?.imageBytes ?? 0,
    },
    {
      key: "thumbnails",
      icon: ImageIcon,
      label: "Share thumbnails",
      count: usage?.thumbnailCount ?? 0,
      bytes: usage?.thumbnailBytes ?? 0,
    },
  ];

  const combinedImageBytes = (usage?.imageBytes ?? 0) + (usage?.thumbnailBytes ?? 0);
  const combinedImageCount = (usage?.imageCount ?? 0) + (usage?.thumbnailCount ?? 0);
  const usedBytes = usage ? usage.textBytes + combinedImageBytes : 0;
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-app-ink-faint">
              <ImageIcon className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Images</span>
            </div>
            <button
              type="button"
              aria-label="Recalculate image storage"
              disabled={isRecalculating}
              onClick={() => void recalculateImageUsage()}
              className="text-app-ink-faint transition hover:text-app-ink disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
            </button>
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums text-app-ink">{formatBytes(combinedImageBytes)}</p>
          <p className="text-xs text-app-ink-faint">{combinedImageCount.toLocaleString()} image{combinedImageCount === 1 ? "" : "s"}</p>
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
          {imageRows.map((row) => (
            <Row key={row.key} icon={row.icon} label={row.label} count={row.count} bytes={row.bytes} />
          ))}
        </div>
      </div>

      <p className="text-xs text-app-ink-faint">
        The Canvas pages/Notes/Todos/Saved links/Reminders sizes above are estimated from the plaintext on this
        device; the total up top counts the encrypted bytes actually stored, which run larger — that number is
        what the 200MB limit is measured against. Canvas images and Share thumbnails come from the server and
        are exact either way — use the refresh icon on the Images card if that ever looks stale.
      </p>
    </section>
  );
}
