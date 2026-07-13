import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Trash2 } from "lucide-react";
import type { EventEntry } from "@omanote/shared";
import { combineDateKeyAndTime } from "@omanote/shared";
import { handlePasteAsLink } from "../lib/link-utils";
import { BaseModal } from "./BaseModal";
import { MobileSaveButton } from "./MobileSaveButton";
import { useHashtagPicker, HashtagPickerDropdown } from "./HashtagPicker";
import { useEmojiPicker, EmojiPickerDropdown } from "./EmojiPicker";
import { parseHashtags, hashtagHighlightSegments, hashtagColor } from "../lib/hashtags";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { isNewlineShortcutEvent, isSaveShortcutEvent } from "../lib/editor-shortcuts";
import { SaveShortcutHint } from "./settings/SaveShortcutHint";

function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function timeToInput(value?: number) {
  if (!value) return "";
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function inputToTimestamp(dateKey: string, time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return combineDateKeyAndTime(dateKey, `${hours}:${minutes}`);
}

export function EventEditorModal({
  event,
  selectedDateKey,
  onClose,
  onSave,
  onDelete,
}: {
  event?: EventEntry | null;
  selectedDateKey: string;
  onClose: () => void;
  onSave: (payload: { label: string; notes?: string; hashtags: string[]; loggedAt: number }) => void;
  onDelete?: () => void;
}) {
  const [label, setLabel] = useState(event?.label ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [time, setTime] = useState(timeToInput(event?.loggedAt) || "09:00");
  const canSave = Boolean(label.trim() && time.trim());
  const labelRef = useRef<HTMLTextAreaElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const { settings } = useUserSettings();

  const labelPicker = useHashtagPicker({
    value: label,
    textareaRef: labelRef,
    onChange: setLabel,
  });
  const notesPicker = useHashtagPicker({
    value: notes,
    textareaRef: notesRef,
    onChange: setNotes,
  });
  const labelEmojiPicker = useEmojiPicker({
    value: label,
    textareaRef: labelRef,
    onChange: setLabel,
  });
  const notesEmojiPicker = useEmojiPicker({
    value: notes,
    textareaRef: notesRef,
    onChange: setNotes,
  });
  useEffect(() => {
    const nextLabel = event?.label ?? "";
    const nextNotes = event?.notes ?? "";
    const nextTime = timeToInput(event?.loggedAt) || "09:00";
    setLabel(nextLabel);
    setNotes(nextNotes);
    setTime(nextTime);
  }, [event]);

  useEffect(() => {
    labelRef.current?.focus();
    if (labelRef.current) {
      const length = labelRef.current.value.length;
      labelRef.current.setSelectionRange(length, length);
    }
  }, []);

  useEffect(() => {
    if (labelRef.current) autoResize(labelRef.current);
  }, [label]);

  useEffect(() => {
    if (notesRef.current) autoResize(notesRef.current);
  }, [notes]);


  const save = () => {
    const nextLabel = label.trim();
    if (!nextLabel || !time.trim()) return;
    const trimmedNotes = notes.trim() || undefined;
    onSave({
      label: nextLabel,
      notes: trimmedNotes,
      hashtags: parseHashtags(nextLabel + (trimmedNotes ? " " + trimmedNotes : "")),
      loggedAt: inputToTimestamp(selectedDateKey, time).getTime(),
    });
  };

  const cancel = () => {
    setLabel(event?.label ?? "");
    setNotes(event?.notes ?? "");
    setTime(timeToInput(event?.loggedAt) || "09:00");
    onClose();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }

    if (event.key === "Enter") {
      if (isSaveShortcutEvent(event, settings.saveShortcut)) {
        event.preventDefault();
        save();
        return;
      }
      if (event.currentTarget instanceof HTMLTextAreaElement && isNewlineShortcutEvent(event, settings.newlineShortcut)) {
        return;
      }
      event.preventDefault();
    }
  };

  return (
    <BaseModal onClose={cancel} onBackdropMouseDown={cancel}>
      <div
        className="w-full max-w-2xl rounded-app-dialog border border-app-line bg-app-surface p-5 shadow-soft"
        onMouseDown={(event) => event.stopPropagation()}
      >
          <div className="flex items-start gap-4">
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 w-[104px] flex-none rounded-md border border-app-line bg-app-surface-muted px-2 py-0.5 text-sm font-medium text-app-ink-faint shadow-none outline-none focus:border-app-line-strong"
            />

            <div className="min-w-0 flex-1">
              <div className="relative">
                {/* Highlight backdrop */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 w-full select-none whitespace-pre-wrap break-words p-0 text-[28px] font-bold leading-[1.25] text-transparent"
                >
                  {hashtagHighlightSegments(label).map(({ text, isHashtag, name }, i) => {
                    if (isHashtag && name) {
                      const color = hashtagColor(name);
                      const leading = text.length > name.length + 1 ? text[0] : "";
                      return (
                        <span key={i}>
                          {leading}
                          <mark className={`${color.bg} ${color.darkBg} rounded-full`} style={{ color: "transparent" }}>
                            #{name}
                          </mark>
                        </span>
                      );
                    }
                    return <span key={i}>{text}</span>;
                  })}
                  {label === "" && "\u200b"}
                </div>
                <textarea
                  ref={labelRef}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  onPaste={(event) => {
                    handlePasteAsLink(event, label, setLabel);
                  }}
                  onKeyDown={(event) => {
                    if (labelPicker.handleKeyDown(event)) return;
                    if (labelEmojiPicker.handleKeyDown(event)) return;
                    handleKeyDown(event);
                  }}
                  rows={1}
                  placeholder="What happened?"
                  className="relative block w-full resize-none border-0 bg-transparent p-0 text-[28px] font-bold leading-[1.25] text-app-ink caret-app-ink outline-none placeholder:text-app-ink-faint selection:bg-app-surface-muted selection:text-app-ink"
                />
                <HashtagPickerDropdown
                  isOpen={labelPicker.isOpen}
                  suggestions={labelPicker.suggestions}
                  activeIndex={labelPicker.activeIndex}
                  onSelect={labelPicker.selectSuggestion}
                  onHover={labelPicker.setActiveIndex}
                  anchorRef={labelRef}
                />
                <EmojiPickerDropdown
                  isOpen={labelEmojiPicker.isOpen}
                  suggestions={labelEmojiPicker.suggestions}
                  activeIndex={labelEmojiPicker.activeIndex}
                  onSelect={labelEmojiPicker.selectSuggestion}
                  onHover={labelEmojiPicker.setActiveIndex}
                  anchorRef={labelRef}
                />
              </div>
              <p className="mt-2 text-sm text-app-ink-faint">{selectedDateKey}</p>
              <div className="relative mt-4">
                {/* Highlight backdrop */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 w-full select-none whitespace-pre-wrap break-words p-0 text-base leading-7 text-transparent"
                >
                  {hashtagHighlightSegments(notes).map(({ text, isHashtag, name }, i) => {
                    if (isHashtag && name) {
                      const color = hashtagColor(name);
                      const leading = text.length > name.length + 1 ? text[0] : "";
                      return (
                        <span key={i}>
                          {leading}
                          <mark className={`${color.bg} ${color.darkBg} rounded-full`} style={{ color: "transparent" }}>
                            #{name}
                          </mark>
                        </span>
                      );
                    }
                    return <span key={i}>{text}</span>;
                  })}
                  {notes === "" && "\u200b"}
                </div>
                <textarea
                  ref={notesRef}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  onPaste={(event) => {
                    handlePasteAsLink(event, notes, setNotes);
                  }}
                  onKeyDown={(event) => {
                    if (notesPicker.handleKeyDown(event)) return;
                    if (notesEmojiPicker.handleKeyDown(event)) return;
                    handleKeyDown(event);
                  }}
                  placeholder="Add notes"
                  rows={1}
                  className="relative block w-full resize-none border-0 bg-transparent p-0 text-base leading-7 text-app-ink-muted outline-none placeholder:text-app-ink-faint caret-app-ink selection:bg-app-surface-muted selection:text-app-ink"
                />
                <HashtagPickerDropdown
                  isOpen={notesPicker.isOpen}
                  suggestions={notesPicker.suggestions}
                  activeIndex={notesPicker.activeIndex}
                  onSelect={notesPicker.selectSuggestion}
                  onHover={notesPicker.setActiveIndex}
                  anchorRef={notesRef}
                />
                <EmojiPickerDropdown
                  isOpen={notesEmojiPicker.isOpen}
                  suggestions={notesEmojiPicker.suggestions}
                  activeIndex={notesEmojiPicker.activeIndex}
                  onSelect={notesEmojiPicker.selectSuggestion}
                  onHover={notesEmojiPicker.setActiveIndex}
                  anchorRef={notesRef}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            {event && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="ml-auto flex items-center gap-2">
              <SaveShortcutHint className="hidden text-sm md:inline" />
              <MobileSaveButton disabled={!canSave} onClick={save} />
            </div>
          </div>
        </div>
    </BaseModal>
  );
}
