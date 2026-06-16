import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { TodoItem } from "@omanote/shared";
import { parseTodoDraftInput } from "@omanote/shared";
import { handlePasteAsLink } from "../lib/link-utils";
import { BaseModal } from "./BaseModal";
import { MobileSaveButton } from "./MobileSaveButton";
import { useHashtagPicker, HashtagPickerDropdown } from "./HashtagPicker";
import { parseHashtags, hashtagHighlightSegments, hashtagColor } from "../lib/hashtags";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { isNewlineShortcutEvent, isSaveShortcutEvent } from "../lib/editor-shortcuts";
import { SaveShortcutHint } from "./settings/SaveShortcutHint";

function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function TodoEditorModal({
  todo,
  selectedDateKey,
  onClose,
  onSave,
}: {
  todo?: TodoItem | null;
  selectedDateKey: string;
  onClose: () => void;
  onSave: (payload: { title: string; hashtags: string[]; dueDateKey?: string; dueTime?: string }) => void;
}) {
  const initialValue = todo?.title ?? "";
  const [draft, setDraft] = useState(initialValue);
  const [error, setError] = useState("");
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const canSave = Boolean(draft.trim());
  const { settings } = useUserSettings();

  const hashtagPicker = useHashtagPicker({
    value: draft,
    textareaRef: draftRef,
    onChange: (next) => { setDraft(next); setError(""); },
  });

  useEffect(() => {
    setDraft(initialValue);
    setError("");
  }, [initialValue]);

  useEffect(() => {
    draftRef.current?.focus();
    if (draftRef.current) {
      const length = draftRef.current.value.length;
      draftRef.current.setSelectionRange(length, length);
      autoResize(draftRef.current);
    }
  }, []);

  useEffect(() => {
    if (draftRef.current) autoResize(draftRef.current);
  }, [draft]);

  const save = () => {
    const parsed = parseTodoDraftInput(draft);
    if (!parsed.title.trim()) {
      setError("Write something like team sync tomorrow 4pm.");
      return;
    }

    onSave({
      title: parsed.title.trim(),
      hashtags: parseHashtags(draft),
      dueDateKey: parsed.dueDateKey,
      dueTime: parsed.dueTime,
    });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (hashtagPicker.handleKeyDown(event)) return;
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

  return (
    <BaseModal onClose={onClose} onBackdropMouseDown={onClose}>
      <div
        className="w-full max-w-2xl rounded-app-dialog border border-app-line bg-app-surface p-5 shadow-soft"
        onMouseDown={(event) => event.stopPropagation()}
      >
          <div className="flex items-start gap-4">
            <div className="flex h-8 flex-none items-center rounded-md border border-app-line bg-app-surface-muted px-3 text-sm font-medium text-app-ink-faint">
              {selectedDateKey}
            </div>

            <div className="relative min-w-0 flex-1">
              <div className="relative">
                {/* Highlight backdrop */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 w-full select-none whitespace-pre-wrap break-words p-0 text-[28px] font-bold leading-[1.25] text-transparent"
                >
                  {hashtagHighlightSegments(draft).map(({ text, isHashtag, name }, i) => {
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
                  {draft === "" && "\u200b"}
                </div>
                <textarea
                  ref={draftRef}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setError("");
                  }}
                  onPaste={(event) => {
                    handlePasteAsLink(event, draft, setDraft);
                  }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Pay rent tomorrow 9am"
                  className="relative block w-full resize-none border-0 bg-transparent p-0 text-[28px] font-bold leading-[1.25] text-app-ink caret-app-ink outline-none placeholder:text-app-ink-faint selection:bg-app-surface-muted selection:text-app-ink"
                />
              </div>
              <HashtagPickerDropdown
                isOpen={hashtagPicker.isOpen}
                suggestions={hashtagPicker.suggestions}
                activeIndex={hashtagPicker.activeIndex}
                onSelect={hashtagPicker.selectSuggestion}
                onHover={hashtagPicker.setActiveIndex}
                anchorRef={draftRef}
              />
              <p className="mt-2 text-sm text-app-ink-faint">Use natural language, like “Email Maya next monday 2pm”.</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <SaveShortcutHint className="hidden text-sm md:inline" />
                <MobileSaveButton disabled={!canSave} onClick={save} />
              </div>
              {error ? <p className="mt-3 text-sm text-danger-ink">{error}</p> : null}
            </div>
          </div>
        </div>
    </BaseModal>
  );
}
