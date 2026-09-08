import { useState } from "react";
import { Download, X } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useApp } from "../app/AppProvider";
import { BaseModal } from "./BaseModal";
import { Button, CheckboxField } from "./ui";

type ExportCat = "todos" | "notes" | "pages" | "bookmarks" | "events" | "rss";

const CATS: ExportCat[] = ["todos", "notes", "pages", "bookmarks", "events", "rss"];
const CAT_LABELS: Record<ExportCat, string> = {
  todos: "Todos",
  notes: "Notes",
  pages: "Canvas pages",
  bookmarks: "Bookmarks",
  events: "Events",
  rss: "RSS subscriptions",
};

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportDataPanel() {
  const { state } = useApp();
  const rssSubscriptions = useQuery(api.rss.listSubscriptions);
  const rssCategories = useQuery(api.rss.listCategories);
  const [selected, setSelected] = useState<Set<ExportCat>>(new Set(CATS));
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState(false);

  const counts: Record<ExportCat, number> = {
    todos: state.todos.filter((t) => !t.deletedAt).length,
    notes: state.notes.length,
    pages: state.pages.filter((p) => !p.deletedAt).length,
    bookmarks: state.bookmarks.length,
    events: state.events.filter((r) => !r.deletedAt).length,
    rss: rssSubscriptions?.length ?? 0,
  };
  const totalAll = CATS.reduce((s, c) => s + counts[c], 0);
  const totalSelected = CATS.filter((c) => selected.has(c)).reduce((s, c) => s + counts[c], 0);
  const allChecked = CATS.every((c) => selected.has(c));

  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(CATS));
  const toggle = (c: ExportCat) =>
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(c) ? s.delete(c) : s.add(c);
      return s;
    });

  const handleExport = async () => {
    setLoading(true);
    setExported(false);
    try {
      const payload: Record<string, unknown> = {
        version: 1,
        app: "omanote",
        exportedAt: new Date().toISOString(),
        warning: "This file contains unencrypted data. Store it securely.",
      };

      if (selected.has("todos")) {
        const todoFolderById = new Map(state.todoFolders.map((folder) => [folder.id, folder]));
        payload.todos = state.todos
          .filter((t) => !t.deletedAt)
          .map((t) => {
            const folder = t.folderId ? todoFolderById.get(t.folderId) : undefined;
            return {
              title: t.title,
              notes: t.notes ?? null,
              folderName: folder?.name ?? t.folderName ?? null,
              folderIcon: folder?.icon ?? null,
              dueDateKey: t.dueDateKey ?? null,
              dueTime: t.dueTime ?? null,
              priority: t.priority,
              status: t.status,
              createdDateKey: t.createdDateKey,
              createdAt: t.createdAt,
              recurrence: t.recurrence ?? null,
              reminderEveryMinutes: t.reminderEveryMinutes ?? null,
              reminderUntil: t.reminderUntil ?? null,
            };
          });
      }

      if (selected.has("notes")) {
        const folderById = new Map(state.noteFolders.map((f) => [f.id, f]));
        payload.notes = state.notes
          .map((n) => {
            const folder = n.folderId ? folderById.get(n.folderId) : undefined;
            return {
              title: n.title ?? null,
              body: n.body,
              tags: n.tags,
              folderName: folder?.name ?? n.folderName ?? null,
              folderIcon: folder?.icon ?? null,
              createdDateKey: n.createdDateKey,
              createdAt: n.createdAt,
            };
          });
      }

      if (selected.has("pages")) {
        payload.pages = state.pages
          .filter((p) => !p.deletedAt)
          .map((p) => ({
            title: p.title ?? null,
            docJson: p.docJson,
            preview: p.preview,
            hashtags: p.hashtags ?? [],
            createdDateKey: p.createdDateKey,
            createdAt: p.createdAt,
          }));
      }

      if (selected.has("bookmarks")) {
        const catById = new Map(state.bookmarkCategories.map((c) => [c.id, c]));
        payload.bookmarks = state.bookmarks
          .map((b) => {
            const category = catById.get(b.categoryId);
            return {
              url: b.url,
              title: b.title,
              siteName: b.siteName ?? null,
              description: b.description ?? null,
              thumbnailUrl: b.thumbnailUrl ?? null,
              faviconUrl: b.faviconUrl ?? null,
              categoryName: category?.name ?? null,
              categoryIcon: category?.icon ?? null,
              createdDateKey: b.createdDateKey,
              createdAt: b.createdAt,
            };
          });
      }

      if (selected.has("events")) {
        payload.events = state.events
          .filter((r) => !r.deletedAt)
          .map((r) => ({
            label: r.label,
            notes: r.notes ?? null,
            loggedAt: r.loggedAt,
            createdDateKey: r.createdDateKey,
            createdAt: r.createdAt,
          }));
      }

      if (selected.has("rss") && rssSubscriptions) {
        const categoryById = new Map((rssCategories ?? []).map((c) => [c._id, c]));
        payload.rssSubscriptions = rssSubscriptions.map((sub) => {
          const category = sub.categoryId ? categoryById.get(sub.categoryId) : undefined;
          return {
            title: sub.title,
            feedUrl: sub.feedUrl,
            siteUrl: sub.siteUrl ?? null,
            description: sub.description ?? null,
            faviconUrl: sub.faviconUrl ?? null,
            categoryName: category?.name ?? null,
            categoryIcon: category?.icon ?? null,
          };
        });
      }

      const date = new Date().toISOString().slice(0, 10);
      downloadJson(payload, `omanote-export-${date}.json`);
      setExported(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mt-4 space-y-1">
        <CategoryRow
          label="All"
          count={totalAll}
          checked={allChecked}
          indeterminate={!allChecked && selected.size > 0}
          onChange={toggleAll}
          bold
        />
        <div className="ml-4 space-y-0.5">
          {CATS.map((cat) => (
            <CategoryRow
              key={cat}
              label={CAT_LABELS[cat]}
              count={counts[cat]}
              checked={selected.has(cat)}
              onChange={() => toggle(cat)}
            />
          ))}
        </div>
      </div>

      {exported ? (
        <p className="mt-4 rounded-md border border-success-line bg-success-surface px-3 py-2 text-sm text-success-ink">
          Export downloaded. Store the file securely.
        </p>
      ) : null}

      <div className="mt-5 flex justify-end">
        <Button
          className="gap-2"
          onClick={() => void handleExport()}
          disabled={loading || selected.size === 0 || (selected.has("rss") && rssSubscriptions === undefined)}
        >
          <Download className="h-4 w-4" />
          {loading ? "Preparing…" : `Export ${totalSelected} item${totalSelected !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </>
  );
}

/** @deprecated Use ExportDataPanel for inline rendering */
export function ExportDataModal({ onClose }: { onClose: () => void }) {
  return (
    <BaseModal
      onClose={onClose}
      onBackdropMouseDown={onClose}
      className="items-end bg-black/40 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        className="w-full max-w-sm rounded-app-dialog border border-app-line bg-app-surface shadow-app-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-app-line p-5 pb-4">
          <div>
            <h2 className="text-sm font-bold text-app-ink">Export Data</h2>
            <p className="mt-0.5 text-xs text-app-ink-faint">Downloads plaintext JSON — store the file securely.</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 mt-0.5 rounded-lg p-1 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <ExportDataPanel />
        </div>
      </div>
    </BaseModal>
  );
}

function CategoryRow({
  label,
  count,
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  bold = false,
}: {
  label: string;
  count: number;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
  bold?: boolean;
}) {
  return (
    <CheckboxField
      checked={checked}
      disabled={disabled}
      indeterminate={indeterminate}
      labelClassName={bold ? "font-medium text-app-ink" : "text-app-ink-muted"}
      onCheckedChange={onChange}
      trailing={count}
      className="px-3 py-2 hover:bg-app-surface-hover"
    >
      {label}
    </CheckboxField>
  );
}
