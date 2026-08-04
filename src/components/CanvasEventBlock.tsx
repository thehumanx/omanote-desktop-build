import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, TouchEvent } from "react";
import { useCanvasDraftValue } from "../app/useCanvasDraftValue";
import { Trash2, WifiOff } from "lucide-react";
import type { EventEntry } from "@omanote/shared";
import type { AppAction } from "../app/types";
import { combineDateKeyAndTime, formatTimeLabel } from "@omanote/shared";
import { handlePasteAsLink } from "../lib/link-utils";
import { useOutsideClick } from "../lib/useOutsideClick";
import { useIsMobileViewport } from "../lib/mobile";
import { MobileEditDrawer } from "./MobileEditDrawer";
import { Input } from "./ui";
import { RichTextPreview } from "./rich-text";
import { parseHashtags } from "../lib/hashtags";
import { AttachmentLinkPreview } from "./AttachmentLinkPreview";
import { focusWithoutScrolling } from "../lib/preserve-focus-scroll";
import { HashtagPickerDropdown, useHashtagPicker } from "./HashtagPicker";
import { EmojiPickerDropdown, useEmojiPicker } from "./EmojiPicker";

function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function timeToInput(value?: number) {
  if (!value) return "";
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export type CanvasEventBlockProps = {
  event: EventEntry;
  pendingSync?: boolean;
  dispatch: (action: AppAction) => void;
};

function areCanvasEventBlockPropsEqual(prev: CanvasEventBlockProps, next: CanvasEventBlockProps) {
  return prev.event === next.event && prev.pendingSync === next.pendingSync && prev.dispatch === next.dispatch;
}

function CanvasEventBlockComponent({ event, pendingSync, dispatch }: CanvasEventBlockProps) {
  const isReadOnly = event.sourceType === "todo_completed";
  const draftKey = `event:${event.id}`;
  const { value: label, setValue: setLabel, clearDraft: clearLabelDraft } = useCanvasDraftValue(draftKey, event.label);
  const { value: notes, setValue: setNotes, clearDraft: clearNotesDraft } = useCanvasDraftValue(`${draftKey}:notes`, event.notes ?? "");
  const [draftTime, setDraftTime] = useState(timeToInput(event.loggedAt));
  const [isEditing, setIsEditing] = useState(false);
  const [focusTarget, setFocusTarget] = useState<"time" | "label" | "notes">("label");
  const [activeField, setActiveField] = useState<"label" | "notes">("label");
  const labelRef = useRef<HTMLTextAreaElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const timeRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastCommittedSignatureRef = useRef(
    `${event.label}\u0000${event.notes ?? ""}\u0000${timeToInput(event.loggedAt)}`,
  );

  const isPopoverEvent = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    return Boolean(target?.closest('[data-rich-text-popover="true"]'));
  };
  const activeHashtagPicker = useHashtagPicker({
    value: activeField === "label" ? label : notes,
    textareaRef: activeField === "label" ? labelRef : notesRef,
    onChange: activeField === "label" ? setLabel : setNotes,
  });
  const activeEmojiPicker = useEmojiPicker({
    value: activeField === "label" ? label : notes,
    textareaRef: activeField === "label" ? labelRef : notesRef,
    onChange: activeField === "label" ? setLabel : setNotes,
  });

  useEffect(() => {
    if (labelRef.current) autoResize(labelRef.current);
  }, [label]);

  useEffect(() => {
    if (notesRef.current) autoResize(notesRef.current);
  }, [notes]);

  useEffect(() => {
    setDraftTime(timeToInput(event.loggedAt));
  }, [event.loggedAt]);

  useEffect(() => {
    if (!isEditing) return;
    if (focusTarget === "time") {
      if (!timeRef.current) return;
      return focusWithoutScrolling(timeRef.current, () => {
        timeRef.current?.focus({ preventScroll: true });
      });
    }
    if (focusTarget === "notes") {
      if (!notesRef.current) return;
      return focusWithoutScrolling(notesRef.current, () => {
        const notesInput = notesRef.current;
        if (!notesInput) return;
        notesInput.focus({ preventScroll: true });
        notesInput.setSelectionRange(notesInput.value.length, notesInput.value.length);
      });
    }
    if (!labelRef.current) return;
    return focusWithoutScrolling(labelRef.current, () => {
      const labelInput = labelRef.current;
      if (!labelInput) return;
      labelInput.focus({ preventScroll: true });
      labelInput.setSelectionRange(labelInput.value.length, labelInput.value.length);
    });
  }, [focusTarget, isEditing]);

  useEffect(() => {
    lastCommittedSignatureRef.current = `${event.label}\u0000${event.notes ?? ""}\u0000${timeToInput(event.loggedAt)}`;
  }, [event.label, event.loggedAt, event.notes]);

  const saveEventDraft = useCallback(() => {
    if (isReadOnly) return;
    const nextLabel = label.trim();
    const nextNotes = notes.trim();
    const nextTime = draftTime || timeToInput(event.loggedAt);
    const nextSignature = `${nextLabel}\u0000${nextNotes}\u0000${nextTime}`;
    if (nextSignature === lastCommittedSignatureRef.current) return;
    lastCommittedSignatureRef.current = nextSignature;
    const nextLoggedAt = combineDateKeyAndTime(event.createdDateKey, nextTime);

    if (!nextLabel && !nextNotes) {
      dispatch({ type: "event/delete", eventId: event.id });
      clearLabelDraft();
      clearNotesDraft();
      return;
    }

    const finalLabel = nextLabel || event.label;
    const finalNotes = nextNotes || undefined;
    dispatch({
      type: "event/update",
      eventId: event.id,
      label: finalLabel,
      loggedAt: nextLoggedAt.getTime(),
      notes: finalNotes,
      hashtags: parseHashtags(finalLabel + (finalNotes ? " " + finalNotes : "")),
    });
    clearLabelDraft();
    clearNotesDraft();
  }, [clearLabelDraft, clearNotesDraft, dispatch, draftTime, label, notes, event.createdDateKey, event.id, event.loggedAt]);

  const updateEventLabel = (nextValue: string) => {
    if (isReadOnly) return;
    const nextLabel = nextValue.trim();
    if (!nextLabel) return;
    dispatch({
      type: "event/update",
      eventId: event.id,
      label: nextLabel,
      loggedAt: event.loggedAt,
      notes: event.notes ?? undefined,
      hashtags: parseHashtags(nextLabel + (event.notes ? " " + event.notes : "")),
    });
  };

  const updateEventNotes = (nextValue: string) => {
    if (isReadOnly) return;
    const nextNotes = nextValue.trim() || undefined;
    dispatch({
      type: "event/update",
      eventId: event.id,
      label: event.label,
      loggedAt: event.loggedAt,
      notes: nextNotes,
      hashtags: parseHashtags(event.label + (nextNotes ? " " + nextNotes : "")),
    });
  };

  const finishEditing = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    saveEventDraft();
    setIsEditing(false);
  }, [saveEventDraft]);

  const isMobile = useIsMobileViewport();

  // On mobile the editor renders inside a MobileEditDrawer portal, so a
  // click there wouldn't register as "outside" rootRef anyway — the
  // drawer's own backdrop/drag dismissal (wired to finishEditing) replaces this.
  useOutsideClick(rootRef, isEditing && !isMobile, finishEditing);

  useEffect(() => {
    const nextSignature = `${label.trim()}\u0000${notes.trim()}\u0000${draftTime || timeToInput(event.loggedAt)}`;
    if (nextSignature === lastCommittedSignatureRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      saveEventDraft();
    }, 350);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [draftTime, label, notes, event.loggedAt, saveEventDraft]);

  const editingInline = isEditing && !isMobile;

  // Mobile opens editing on long-press instead of a tap, so a normal tap
  // can still be used to scroll. The time chip already opens editing on its
  // own tap (a small, explicit target) — long-press only applies to the
  // rest of the row and skips it, matching the checkbox/pencil/trash-style
  // exclusions used elsewhere.
  const LONG_PRESS_MS = 450;
  const LONG_PRESS_MOVE_CANCEL_PX = 10;
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressSkipRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => clearLongPressTimer, []);

  const handlePreviewTouchStart = (touchEvent: TouchEvent<HTMLDivElement>) => {
    if (isReadOnly) return;
    const touch = touchEvent.touches[0];
    if (!touch) return;
    const eventTarget = touchEvent.target as HTMLElement | null;
    longPressSkipRef.current = Boolean(eventTarget?.closest('button, a, [data-rich-text-popover="true"]'));
    if (longPressSkipRef.current) return;
    longPressStartRef.current = { x: touch.clientX, y: touch.clientY };
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      setFocusTarget("label");
      setIsEditing(true);
    }, LONG_PRESS_MS);
  };

  const handlePreviewTouchMove = (touchEvent: TouchEvent<HTMLDivElement>) => {
    const start = longPressStartRef.current;
    const touch = touchEvent.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_CANCEL_PX) {
      clearLongPressTimer();
    }
  };

  const handlePreviewTouchEnd = (touchEvent: TouchEvent<HTMLDivElement>) => {
    clearLongPressTimer();
    // Whether this was a short tap or the long-press already fired, don't
    // let the browser's synthetic click also fire — except on a link/button/
    // popover, which needs its own click to fire normally.
    if (!longPressSkipRef.current) {
      touchEvent.preventDefault();
    }
    longPressStartRef.current = null;
  };

  const preview = (
    <div
      role={isReadOnly || isEditing ? undefined : "button"}
      tabIndex={isReadOnly || isEditing ? undefined : 0}
      className={
        isReadOnly || isEditing || !isMobile
          ? "flex w-full items-start gap-2 text-left outline-none"
          : "flex w-full select-none items-start gap-2 text-left outline-none [-webkit-touch-callout:none]"
      }
      onClick={(event) => {
        if (isReadOnly || isEditing || isPopoverEvent(event)) return;
        setFocusTarget("label");
        setIsEditing(true);
      }}
      onDoubleClick={(event) => {
        if (isReadOnly || isEditing || isPopoverEvent(event)) return;
        setFocusTarget("label");
        setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (isReadOnly || isEditing) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setFocusTarget("label");
          setIsEditing(true);
        }
      }}
      onTouchStart={isReadOnly || isEditing || !isMobile ? undefined : handlePreviewTouchStart}
      onTouchMove={isReadOnly || isEditing || !isMobile ? undefined : handlePreviewTouchMove}
      onTouchEnd={isReadOnly || isEditing || !isMobile ? undefined : handlePreviewTouchEnd}
      onTouchCancel={isReadOnly || isEditing || !isMobile ? undefined : handlePreviewTouchEnd}
    >
      <div className="flex flex-none items-center">
        <button
          type="button"
          aria-label="edit event time"
          disabled={isReadOnly || isEditing}
          onClick={(event) => {
            if (isReadOnly || isEditing) return;
            event.preventDefault();
            event.stopPropagation();
            setFocusTarget("time");
            setIsEditing(true);
          }}
          className="h-6 rounded-md border border-app-line bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-faint shadow-none"
        >
          {formatTimeLabel(draftTime)}
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base leading-6 text-app-ink">
          <RichTextPreview value={label} onLinkEdit={isEditing ? undefined : updateEventLabel} />
        </div>
        {notes ? (
          <div className="mt-1 text-sm leading-7 text-app-ink-muted">
            <RichTextPreview value={notes} paragraphClassName="text-app-ink-muted" onLinkEdit={isEditing ? undefined : updateEventNotes} />
          </div>
        ) : null}
        <AttachmentLinkPreview textValues={[label, notes]} className="mt-2" />
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      data-testid="canvas-event-block"
      className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover focus-within:bg-app-surface-muted focus-within:ring-1 focus-within:ring-app-focus/15 before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-px before:rounded-full before:bg-transparent focus-within:before:bg-app-line-strong"
    >
      {pendingSync && (
        <div className="absolute right-2 top-2 flex items-center justify-center rounded-full bg-app-surface-muted p-1" title="Not synced — will upload when you reconnect">
          <WifiOff className="h-2.5 w-2.5 text-app-ink-faint" />
        </div>
      )}
      {/* On mobile, editing opens in a drawer elsewhere on screen — keep
          showing the (live-updating) preview here instead of leaving this
          canvas row blank while the drawer is open. */}
      {editingInline ? null : preview}
      {isEditing ? (
        <MobileEditDrawer onClose={finishEditing} onCancel={finishEditing} onSave={finishEditing} canSave={Boolean(label.trim())}>
          <div data-testid="canvas-event-edit-row" className="flex w-full flex-col gap-2">
            <div className="flex flex-none items-center">
              <Input
                ref={timeRef}
                type="time"
                value={draftTime}
                onChange={(event) => setDraftTime(event.target.value)}
                onBlur={() => {
                  if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
                  saveTimerRef.current = null;
                  saveEventDraft();
                }}
                className="h-6 w-[92px] flex-none rounded-md border border-app-line bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-faint shadow-none absolute opacity-0 pointer-events-none"
              />
              <button
                type="button"
                onClick={() => timeRef.current?.click()}
                className="h-6 w-[92px] rounded-md border border-app-line bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-faint shadow-none"
              >
                {formatTimeLabel(draftTime)}
              </button>
            </div>
            <div className="min-w-0 w-full flex-1">
              <textarea
                ref={labelRef}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                onPaste={(event) => {
                  handlePasteAsLink(event, label, setLabel);
                }}
                onFocus={() => {
                  setFocusTarget("label");
                  setActiveField("label");
                }}
                onKeyDown={(event) => {
                  if (activeHashtagPicker.handleKeyDown(event)) return;
                  if (activeEmojiPicker.handleKeyDown(event)) return;
                }}
                onBlur={() => {
                  if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
                  saveTimerRef.current = null;
                  saveEventDraft();
                }}
                rows={1}
                className="block w-full resize-none border-0 bg-transparent p-0 text-base leading-6 text-app-ink caret-app-ink outline-none selection:bg-app-surface-muted selection:text-app-ink placeholder:text-app-line-strong"
              />
              <textarea
                ref={notesRef}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onPaste={(event) => {
                  handlePasteAsLink(event, notes, setNotes);
                }}
                onFocus={() => {
                  setFocusTarget("notes");
                  setActiveField("notes");
                }}
                onKeyDown={(event) => {
                  if (activeHashtagPicker.handleKeyDown(event)) return;
                  if (activeEmojiPicker.handleKeyDown(event)) return;
                }}
                onBlur={() => {
                  if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
                  saveTimerRef.current = null;
                  saveEventDraft();
                }}
                placeholder="Add notes"
                rows={1}
                className="mt-1 block w-full resize-none border-0 bg-transparent p-0 text-sm leading-7 text-app-ink-muted outline-none placeholder:text-app-line-strong caret-app-ink selection:bg-app-surface-muted selection:text-app-ink"
              />
            </div>
          </div>
          <HashtagPickerDropdown
            isOpen={activeHashtagPicker.isOpen}
            suggestions={activeHashtagPicker.suggestions}
            activeIndex={activeHashtagPicker.activeIndex}
            onSelect={activeHashtagPicker.selectSuggestion}
            onHover={activeHashtagPicker.setActiveIndex}
            anchorRef={activeField === "label" ? labelRef : notesRef}
          />
          <EmojiPickerDropdown
            isOpen={activeEmojiPicker.isOpen}
            suggestions={activeEmojiPicker.suggestions}
            activeIndex={activeEmojiPicker.activeIndex}
            onSelect={activeEmojiPicker.selectSuggestion}
            onHover={activeEmojiPicker.setActiveIndex}
            anchorRef={activeField === "label" ? labelRef : notesRef}
          />
        </MobileEditDrawer>
      ) : null}

      {isReadOnly ? (
        event.sourceTodoId ? (
          <button
            aria-label="uncheck todo"
            onClick={() => dispatch({ type: "todo/toggle", todoId: event.sourceTodoId! })}
            className="absolute right-1 top-1 rounded-full p-1 text-app-line-strong opacity-0 transition group-hover:bg-app-surface group-hover:opacity-100 hover:bg-app-surface-hover hover:text-app-ink-muted"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null
      ) : (
        <button
          aria-label="delete event"
          onClick={() => {
            dispatch({ type: "event/delete", eventId: event.id });
            clearLabelDraft();
            clearNotesDraft();
          }}
          className="absolute right-1 top-1 rounded-full p-1 text-app-line-strong opacity-0 transition group-hover:bg-app-surface group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-app-surface-hover hover:text-danger-ink"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export const CanvasEventBlock = memo(CanvasEventBlockComponent, areCanvasEventBlockPropsEqual);
