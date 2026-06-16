import { useRef, useState } from "react";
import { AlertTriangle, FileJson, Upload, X } from "lucide-react";
import { useApp } from "../app/AppProvider";
import type { DateKey } from "@omanote/shared";
import { BaseModal } from "./BaseModal";
import { Button } from "./ui";

type ImportCat = "todos" | "notes" | "bookmarks" | "events";

const CATS: ImportCat[] = ["todos", "notes", "bookmarks", "events"];
const CAT_LABELS: Record<ImportCat, string> = {
  todos: "Todos",
  notes: "Notes",
  bookmarks: "Bookmarks",
  events: "Events",
};

type ExportedTodo = {
  title: string;
  notes: string | null;
  dueDateKey: string | null;
  dueTime: string | null;
  priority: "normal" | "high";
  status: "open" | "done";
  createdDateKey: string;
  createdAt: number;
  checklistItems?: { text: string; checked: boolean; position: number }[];
};

type ExportedNote = {
  title: string | null;
  body: string;
  tags: string[];
  folderName: string | null;
  createdDateKey: string;
  createdAt: number;
};

type ExportedBookmark = {
  url: string;
  title: string;
  siteName: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  faviconUrl: string | null;
  categoryName: string | null;
  createdDateKey: string;
  createdAt: number;
};

type ExportedEvent = {
  label: string;
  notes: string | null;
  loggedAt: number;
  createdDateKey: string;
  createdAt: number;
};

type ExportPayload = {
  version: number;
  app: string;
  todos?: ExportedTodo[];
  notes?: ExportedNote[];
  bookmarks?: ExportedBookmark[];
  events?: ExportedEvent[];
  routines?: ExportedEvent[];
};

function parseFile(text: string): ExportPayload {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON");
  }
  if (typeof data !== "object" || data === null) throw new Error("Invalid file format");
  const d = data as Record<string, unknown>;
  if (d["version"] !== 1 || d["app"] !== "omanote") {
    throw new Error("This file is not an omanote export (version 1)");
  }
  return d as ExportPayload;
}

export function ImportDataPanel() {
  const { dispatch } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ExportPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<ImportCat>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [done, setDone] = useState(false);

  const counts: Record<ImportCat, number> = {
    todos: parsed?.todos?.length ?? 0,
    notes: parsed?.notes?.length ?? 0,
    bookmarks: parsed?.bookmarks?.length ?? 0,
    events: (parsed?.events?.length ?? 0) + (parsed?.routines?.length ?? 0),
  };
  const presentCats = CATS.filter((c) => counts[c] > 0);
  const allChecked = presentCats.length > 0 && presentCats.every((c) => selected.has(c));
  const anyChecked = CATS.some((c) => selected.has(c));
  const totalSelected = CATS.filter((c) => selected.has(c)).reduce((s, c) => s + counts[c], 0);
  const hasTodoNotes = parsed?.todos?.some((t) => t.notes || t.checklistItems?.length) ?? false;

  const loadFile = (file: File) => {
    setParseError(null);
    setParsed(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseFile(e.target?.result as string);
        setParsed(result);
        const present = new Set<ImportCat>(
          CATS.filter((c) => c === "events" ? ((result.events?.length ?? 0) + (result.routines?.length ?? 0)) > 0 : (result[c]?.length ?? 0) > 0),
        );
        setSelected(present);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Could not parse file");
      }
    };
    reader.readAsText(file);
  };

  const reset = () => {
    setParsed(null);
    setFileName(null);
    setParseError(null);
    setSelected(new Set());
    setDone(false);
    setImportedCount(0);
  };

  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(presentCats));

  const toggle = (c: ImportCat) => {
    if (counts[c] === 0) return;
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(c) ? s.delete(c) : s.add(c);
      return s;
    });
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    let count = 0;
    try {
      if (selected.has("todos") && parsed.todos) {
        for (const t of parsed.todos) {
          dispatch({
            type: "todo/create",
            title: t.title,
            dateKey: t.createdDateKey as DateKey,
            dueDateKey: t.dueDateKey ? (t.dueDateKey as DateKey) : undefined,
            dueTime: t.dueTime ?? undefined,
          });
          count++;
        }
      }
      if (selected.has("notes") && parsed.notes) {
        for (const n of parsed.notes) {
          dispatch({
            type: "note/create",
            body: n.body,
            dateKey: n.createdDateKey as DateKey,
            title: n.title ?? undefined,
            tags: n.tags,
            folderName: n.folderName ?? undefined,
          });
          count++;
        }
      }
      if (selected.has("bookmarks") && parsed.bookmarks) {
        for (const b of parsed.bookmarks) {
          dispatch({
            type: "bookmark/create",
            url: b.url,
            dateKey: b.createdDateKey as DateKey,
            title: b.title,
            categoryName: b.categoryName ?? undefined,
            siteName: b.siteName ?? undefined,
            description: b.description ?? undefined,
            thumbnailUrl: b.thumbnailUrl ?? undefined,
            faviconUrl: b.faviconUrl ?? undefined,
          });
          count++;
        }
      }
      if (selected.has("events")) {
        for (const r of [...(parsed.events ?? []), ...(parsed.routines ?? [])]) {
          dispatch({
            type: "event/create",
            label: r.label,
            dateKey: r.createdDateKey as DateKey,
            loggedAt: r.loggedAt,
            notes: r.notes ?? undefined,
          });
          count++;
        }
      }
      setImportedCount(count);
      setDone(true);
    } finally {
      setImporting(false);
    }
  };

  if (done) {
    return (
      <div className="mt-4">
        <p className="rounded-md border border-success-line bg-success-surface px-3 py-2 text-sm text-success-ink">
          {importedCount} item{importedCount !== 1 ? "s" : ""} queued for import.
        </p>
        <div className="mt-4 flex justify-end">
          <Button onClick={reset}>
            Import another file
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {fileName ? (
        <p className="mb-3 truncate text-xs text-app-ink-faint">{fileName}</p>
      ) : null}

      {!parsed ? (
        <div
          className={`flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-4 py-8 transition ${
            dragging ? "border-app-line-strong bg-app-surface-muted" : "border-app-line hover:border-app-line-strong hover:bg-app-surface-hover"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) loadFile(file);
          }}
        >
          <FileJson className="h-8 w-8 text-app-line-strong" />
          <p className="text-center text-xs text-app-ink-faint">
            Drop your <span className="font-medium text-app-ink-muted">omanote-export.json</span> here
            <br />
            or <span className="font-medium text-app-ink-muted">click to browse</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadFile(f);
            }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="space-y-1">
            <CategoryRow
              label="All"
              count={presentCats.reduce((s, c) => s + counts[c], 0)}
              checked={allChecked}
              indeterminate={!allChecked && anyChecked}
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
                  disabled={counts[cat] === 0}
                  onChange={() => toggle(cat)}
                />
              ))}
            </div>
          </div>

          {hasTodoNotes && (
            <p className="flex items-start gap-1.5 rounded-xl bg-warning-surface px-3 py-2 text-xs text-warning-ink">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Todo notes and checklist items are not imported in this version.
            </p>
          )}

          <button
            className="text-xs text-app-ink-faint underline-offset-2 hover:text-app-ink-muted hover:underline"
            onClick={reset}
          >
            Choose a different file
          </button>
        </div>
      )}

      {parseError && <p className="mt-3 rounded-xl bg-danger-surface px-3 py-2 text-xs text-danger-ink">{parseError}</p>}

      {parsed && (
        <div className="mt-4 flex justify-end">
          <Button
            className="gap-2"
            onClick={() => void handleImport()}
            disabled={importing || !anyChecked || totalSelected === 0}
          >
            <Upload className="h-4 w-4" />
            {importing ? "Importing…" : `Import ${totalSelected} item${totalSelected !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}

/** @deprecated Use ImportDataPanel for inline rendering */
export function ImportDataModal({ onClose }: { onClose: () => void }) {
  return (
    <BaseModal
      onClose={onClose}
      onBackdropMouseDown={onClose}
      className="items-end bg-black/40 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-app-line bg-app-surface shadow-app-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-app-line p-5 pb-4">
          <div>
            <h2 className="text-sm font-bold text-app-ink">Import Data</h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 mt-0.5 rounded-lg p-1 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <ImportDataPanel />
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
  const ref = useRef<HTMLInputElement | null>(null);
  if (ref.current) ref.current.indeterminate = indeterminate;

  return (
    <label
      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
        disabled ? "cursor-default opacity-40" : "cursor-pointer hover:bg-app-surface-hover"
      }`}
    >
      <input
        ref={ref}
        type="checkbox"
        className="h-4 w-4 rounded accent-app-ink"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className={`flex-1 text-sm ${bold ? "font-medium text-app-ink" : "text-app-ink-muted"}`}>{label}</span>
      <span className="text-xs text-app-ink-faint">{count}</span>
    </label>
  );
}
