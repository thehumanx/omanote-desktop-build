import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { RecurrenceRule, TodoFolder, TodoItem } from "@omanote/shared";
import {
  formatDueChip,
  formatNaturalLanguageDueInput,
  materializeReminderFields,
  parseNaturalLanguageDueInput,
  parseRecurrencePhrase,
  ruleToEditablePhrase,
  toDateKey,
} from "@omanote/shared";
import { CheckCircle2, RefreshCw, Repeat } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { handlePasteAsLink } from "../lib/link-utils";
import { BaseModal } from "./BaseModal";
import { parseHashtags } from "../lib/hashtags";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { isNewlineShortcutEvent, isSaveShortcutEvent } from "../lib/editor-shortcuts";
import { SaveShortcutHint } from "./settings/SaveShortcutHint";
import { Button, TodoCheckmark } from "./ui";

function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

const GOOGLE_SYNC_TOOLTIP =
  "Synced with Google Calendar. Editing this here updates that event in place. If it's also edited on Google before the next sync, whichever change syncs last wins — there's no merge of the two.";

function GoogleSyncIndicator({ htmlLink, className }: { htmlLink: string | null; className?: string }) {
  return (
    <div
      title={GOOGLE_SYNC_TOOLTIP}
      className={["inline-flex w-fit items-center gap-1.5 rounded-md bg-app-surface-muted px-2 py-1 text-xs text-app-ink-muted", className]
        .filter(Boolean)
        .join(" ")}
    >
      <RefreshCw className="h-3 w-3" />
      {htmlLink ? (
        <a
          href={htmlLink}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted hover:text-app-ink"
          onClick={(event) => event.stopPropagation()}
        >
          Synced with Google Calendar
        </a>
      ) : (
        <span>Synced with Google Calendar</span>
      )}
    </div>
  );
}

// Bottom drawer on mobile -- full width, rounded top corners, sticky footer
// -- and the existing centered dialog on desktop, everywhere this editor is
// used (Todos, Event/Calendar, and Canvas).
const BACKDROP_CLASS = "items-end px-0 md:items-center md:px-app-page";
const SURFACE_CLASS =
  "w-full rounded-t-app-drawer border-t border-app-line bg-app-surface-raised px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-app-drawer max-h-[85vh] overflow-y-auto md:max-w-4xl md:max-h-none md:overflow-visible md:rounded-app-dialog md:border md:bg-app-surface md:px-7 md:py-6 md:shadow-soft";
// Larger tap targets on the mobile drawer; unchanged on desktop.
const FIELD_ROW_PADDING = "py-2 md:py-1";

function formatCompletedAt(value?: number) {
  if (!value) return "";
  const date = new Date(value);
  const time = date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(":00", "")
    .replace(/\s+/g, "");
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${time}, ${day}`;
}

export function TodoEditorModal({
  todo,
  folders = [],
  selectedFolderId,
  selectedDateKey,
  onClose,
  onSave,
  onToggle,
}: {
  todo?: TodoItem | null;
  folders?: TodoFolder[];
  selectedFolderId?: string | null;
  selectedDateKey: string;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    hashtags: string[];
    dueDateKey?: string;
    dueTime?: string;
    folderId?: string;
    folderName?: string;
    recurrence?: RecurrenceRule | null;
    reminderEveryMinutes?: number | null;
    reminderUntil?: number | null;
  }) => void;
  onToggle?: (todoId: string) => void;
}) {
  const initialTitle = todo?.title ?? "";
  const initialFolderName =
    todo?.folderName ??
    (todo?.folderId ? folders.find((folder) => folder.id === todo.folderId)?.name : undefined) ??
    (selectedFolderId ? folders.find((folder) => folder.id === selectedFolderId)?.name : undefined) ??
    folders.find((folder) => folder.name.toLowerCase() === "others")?.name ??
    folders[0]?.name ??
    "";
  const initialDue = formatNaturalLanguageDueInput(
    todo?.dueDateKey ?? (selectedDateKey as TodoItem["dueDateKey"]),
    todo?.dueTime,
  );
  // Editable natural-language repeat rule. Prefilled so an existing series'
  // cadence, count, and end date can be edited as plain text.
  const initialRepeat = todo?.recurrence
    ? ruleToEditablePhrase(todo.recurrence)
    : todo?.reminderEveryMinutes
      ? `every ${todo.reminderEveryMinutes} minutes`
      : "";
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [draftWhen, setDraftWhen] = useState(initialDue);
  const [draftFolder, setDraftFolder] = useState(initialFolderName);
  const [draftRepeat, setDraftRepeat] = useState(initialRepeat);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const canSave = Boolean(draftTitle.trim());
  const { settings } = useUserSettings();
  const isDone = todo?.status === "done";
  const dueChip = todo
    ? formatDueChip(todo.dueDateKey, todo.dueTime, selectedDateKey as TodoItem["createdDateKey"], todo.createdDateKey)
    : "";
  const completedLabel = formatCompletedAt(todo?.completedAt);
  const googleLink = useQuery(api.googleCalendar.getTodoGoogleLinkSummary, todo ? { todoId: todo.id as any } : "skip");

  // Live parse of the Repeat field for the confirmation chip.
  const parsedRepeat = useMemo(() => {
    const trimmed = draftRepeat.trim();
    if (!trimmed) return null;
    return parseRecurrencePhrase(trimmed, toDateKey(new Date()));
  }, [draftRepeat]);
  const recurrenceChipLabel = parsedRepeat?.description ?? null;

  useEffect(() => {
    setDraftTitle(initialTitle);
    setDraftWhen(initialDue);
    setDraftFolder(initialFolderName);
    setDraftRepeat(initialRepeat);
    setError("");
  }, [initialDue, initialFolderName, initialTitle, initialRepeat]);

  const trimmedFolder = draftFolder.trim();
  const folderFilter = trimmedFolder.toLowerCase();
  const visibleFolders = useMemo(() => {
    if (!folderFilter) return folders;
    return folders.filter((folder) => folder.name.toLowerCase().includes(folderFilter));
  }, [folderFilter, folders]);
  const exactFolderMatch = useMemo(
    () => folders.find((folder) => folder.name.toLowerCase() === folderFilter) ?? null,
    [folderFilter, folders],
  );

  useEffect(() => {
    titleRef.current?.focus();
    if (titleRef.current) {
      const length = titleRef.current.value.length;
      titleRef.current.setSelectionRange(length, length);
    }
  }, []);

  useEffect(() => {
    if (titleRef.current) autoResize(titleRef.current);
  }, [draftTitle]);

  const save = () => {
    const todayKey = toDateKey(new Date());

    const title = draftTitle.trim();
    if (!title) {
      setError("Write something like team sync tomorrow 4pm.");
      return;
    }

    const dueWhen = draftWhen.trim();
    const parsedDue = dueWhen ? parseNaturalLanguageDueInput(dueWhen) : null;
    if (dueWhen && !parsedDue) {
      setError("Try a phrase like tomorrow 9pm or 5 days later.");
      return;
    }

    const repeatText = draftRepeat.trim();
    const parsedRepeatOnSave = repeatText ? parseRecurrencePhrase(repeatText, todayKey) : null;
    if (repeatText && !parsedRepeatOnSave) {
      setError("Try a repeat like every day, every mon and fri, or every week, 5 times.");
      return;
    }

    let dueDateKey = parsedDue?.dateKey as string | undefined;
    let dueTime = parsedDue?.time;
    // undefined = leave unchanged; null = explicitly clear an existing rule.
    let recurrence: RecurrenceRule | null | undefined;
    let reminderEveryMinutes: number | null | undefined;
    let reminderUntil: number | null | undefined;
    if (parsedRepeatOnSave?.kind === "series") {
      // Keep the original series start so editing the count/end doesn't shift
      // the schedule; a fresh series anchors on today.
      recurrence = todo?.recurrence
        ? { ...parsedRepeatOnSave.rule, anchorDateKey: todo.recurrence.anchorDateKey }
        : parsedRepeatOnSave.rule;
      reminderEveryMinutes = null;
      reminderUntil = null;
    } else if (parsedRepeatOnSave?.kind === "reminder") {
      const fields = materializeReminderFields(parsedRepeatOnSave);
      recurrence = null;
      reminderEveryMinutes = fields.reminderEveryMinutes;
      reminderUntil = fields.reminderUntil;
      if (!parsedDue) {
        dueDateKey = fields.dueDateKey;
        dueTime = fields.dueTime;
      }
    } else if (todo?.recurrence || todo?.reminderEveryMinutes) {
      // Had a repeat rule, now the field is empty — clear it.
      recurrence = null;
      reminderEveryMinutes = null;
      reminderUntil = null;
    }

    const folderPayload =
      folders.length || todo?.folderId || todo?.folderName || selectedFolderId
        ? {
            folderId: exactFolderMatch?.id,
            folderName: trimmedFolder || exactFolderMatch?.name || "Others",
          }
        : {};

    onSave({
      title,
      hashtags: parseHashtags(draftTitle),
      dueDateKey,
      dueTime,
      recurrence,
      reminderEveryMinutes,
      reminderUntil,
      ...folderPayload,
    });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "Enter") {
      if (isSaveShortcutEvent(event, settings.saveShortcut)) {
        event.preventDefault();
        save();
        return;
      }
      if (isNewlineShortcutEvent(event, settings.newlineShortcut)) {
        return;
      }
      event.preventDefault();
    }
  };

  if (todo && isDone) {
    return (
      <BaseModal onClose={onClose} onBackdropMouseDown={onClose} className={BACKDROP_CLASS}>
        <div className={SURFACE_CLASS} onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex w-full items-start justify-between gap-6">
            <div className="flex min-w-0 items-center gap-3">
              <TodoCheckmark
                aria-label="toggle todo"
                checked
                disabled={!onToggle}
                onClick={() => {
                  if (!onToggle) return;
                  onToggle(todo.id);
                }}
                align="text"
              />
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 truncate text-base leading-6 text-app-ink-muted line-through decoration-app-ink-muted decoration-2">
                  {todo.title}
                </span>
                {dueChip ? (
                  <span className="shrink-0 rounded-full bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-muted">
                    {dueChip}
                  </span>
                ) : null}
              </div>
            </div>
            {completedLabel ? (
              <div className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-app-ink-muted">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                <span>{completedLabel}</span>
              </div>
            ) : null}
          </div>
          {googleLink ? <GoogleSyncIndicator className="mt-3" htmlLink={googleLink.htmlLink} /> : null}
        </div>
      </BaseModal>
    );
  }

  return (
    <BaseModal onClose={onClose} onBackdropMouseDown={onClose} className={BACKDROP_CLASS}>
      <div className={SURFACE_CLASS} onMouseDown={(event) => event.stopPropagation()}>
        {/* The checkmark only relates to the title -- everything below spans
            the full width instead of trailing its indent, so a single-column
            mobile layout doesn't end up with a permanent empty gutter down
            the left side of every field. */}
        <div className="flex w-full items-start gap-3">
          <TodoCheckmark
            aria-label="toggle todo"
            checked={todo?.status === "done"}
            disabled={!todo || !onToggle}
            onClick={() => {
              if (!todo || !onToggle) return;
              onToggle(todo.id);
            }}
            align="text"
          />
          <textarea
            ref={titleRef}
            aria-label="Todo title"
            value={draftTitle}
            onChange={(event) => {
              setDraftTitle(event.target.value);
              setError("");
            }}
            onPaste={(event) => {
              handlePasteAsLink(event, draftTitle, setDraftTitle);
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Todo title"
            // No top padding: the checkmark's optical "align to text" offset
            // (`--component-todo-checkmark-text-align-offset`) is tuned
            // against a title sitting flush at the top, the same way
            // TodoListRow's title div has none -- adding top padding here
            // would push the first line down past what that offset assumes.
            className="min-w-0 flex-1 resize-none overflow-hidden border-0 border-b border-app-line bg-transparent px-0 pb-2 pt-0 text-base leading-6 text-app-ink outline-none placeholder:text-app-line-strong focus:border-app-line-strong md:pb-1"
          />
        </div>

        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              aria-label="Todo due date"
              value={draftWhen}
              onChange={(event) => {
                setDraftWhen(event.target.value);
                setError("");
              }}
              onPaste={(event) => {
                handlePasteAsLink(event, draftWhen, setDraftWhen);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Tomorrow 9:30pm, 1 hour later, 5 days later"
              className={`min-w-0 flex-1 rounded-none border-0 border-b border-app-line bg-transparent px-0 ${FIELD_ROW_PADDING} text-[15px] text-app-ink-faint outline-none placeholder:text-app-line-strong focus:border-app-line-strong`}
            />
            {(folders.length || todo?.folderId || todo?.folderName || selectedFolderId) ? (
              <div className="relative min-w-0 flex-1">
                <input
                  aria-label="Todo folder"
                  value={draftFolder}
                  onChange={(event) => {
                    setDraftFolder(event.target.value);
                    setFolderMenuOpen(true);
                  }}
                  onFocus={() => setFolderMenuOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Folder"
                  className={`w-full rounded-none border-0 border-b border-app-line bg-transparent px-0 ${FIELD_ROW_PADDING} text-[15px] text-app-ink-faint outline-none placeholder:text-app-line-strong focus:border-app-line-strong`}
                />
                {folderMenuOpen && visibleFolders.length ? (
                  <div
                    className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    {visibleFolders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                        onClick={() => {
                          setDraftFolder(folder.name);
                          setFolderMenuOpen(false);
                        }}
                      >
                        {folder.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 flex-none text-app-ink-faint" />
            <input
              aria-label="Repeat"
              value={draftRepeat}
              onChange={(event) => {
                setDraftRepeat(event.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Repeat — e.g. every day, every mon and fri, every week 5 times"
              className={`min-w-0 flex-1 rounded-none border-0 border-b border-app-line bg-transparent px-0 ${FIELD_ROW_PADDING} text-[15px] text-app-ink-faint outline-none placeholder:text-app-line-strong focus:border-app-line-strong`}
            />
          </div>

          {error ? <p className="text-xs text-danger-ink">{error}</p> : null}

          {recurrenceChipLabel ? (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-app-surface-muted px-2 py-1 text-xs text-app-ink-muted">
              <Repeat className="h-3 w-3" />
              <span>{recurrenceChipLabel}</span>
            </div>
          ) : null}

          {googleLink ? <GoogleSyncIndicator htmlLink={googleLink.htmlLink} /> : null}

          <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex flex-col gap-3 border-t border-app-line bg-app-surface-raised px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:static md:mx-0 md:mb-0 md:flex-row md:flex-wrap md:items-center md:justify-between md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              {["Today", "Tomorrow", "Next Monday", "1 hour later", "2 hours later"].map((label) => {
                const value = label.toLowerCase();
                const active = draftWhen.trim().toLowerCase() === value;
                return (
                  <Button
                    key={label}
                    type="button"
                    tone={active ? "default" : "soft"}
                    className={["h-7 px-2.5 py-0 text-xs font-medium", active ? "text-white" : "text-app-ink-muted"].join(" ")}
                    onClick={() => {
                      setDraftWhen(value);
                      setError("");
                    }}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <SaveShortcutHint className="hidden text-sm md:inline" />
              <Button type="button" tone="default" className="w-full md:hidden" disabled={!canSave} onClick={save}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
