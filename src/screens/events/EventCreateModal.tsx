import { useEffect, useRef, useState } from "react";
import type { DateKey } from "@omanote/shared";
import { BaseModal } from "../../components/BaseModal";
import { DrawerHeaderRow } from "../../components/DrawerHeaderRow";
import { handlePasteAsLink } from "../../lib/link-utils";
import { isNewlineKeyEvent, isSaveKeyEvent } from "../../lib/editor-shortcuts";
import { SaveShortcutHint } from "../../components/settings/SaveShortcutHint";
import { HashtagPickerDropdown, useHashtagPicker } from "../../components/HashtagPicker";
import { EmojiPickerDropdown, useEmojiPicker } from "../../components/EmojiPicker";
import { autoResizeTextArea } from "../../lib/auto-resize";

// Floating card overlay on mobile -- inset from all edges, fully rounded --
// and a centered dialog on desktop, matching TodoEditorModal/BookmarkEditorModal.
const EVENT_CREATE_BACKDROP_CLASS = "items-end px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:items-center md:px-app-page md:pb-0";

const EVENT_CREATE_SURFACE_CLASS =
  "w-full max-w-2xl rounded-app-dialog border border-app-line bg-app-surface-raised p-5 shadow-app-drawer md:bg-app-surface md:shadow-soft";

export function EventCreateModal({
  dateKey,
  startedAt,
  onClose,
  onSave,
}: {
  dateKey: DateKey;
  startedAt: number;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSave = Boolean(value.trim());
  const hashtagPicker = useHashtagPicker({ value, textareaRef, onChange: setValue });
  const emojiPicker = useEmojiPicker({ value, textareaRef, onChange: setValue });

  useEffect(() => {
    textareaRef.current?.focus();
    if (textareaRef.current) autoResizeTextArea(textareaRef.current);
  }, []);

  useEffect(() => {
    if (textareaRef.current) autoResizeTextArea(textareaRef.current);
  }, [value]);

  return (
    <BaseModal onClose={onClose} onBackdropMouseDown={onClose} className={EVENT_CREATE_BACKDROP_CLASS}>
      <div className={EVENT_CREATE_SURFACE_CLASS} onMouseDown={(event) => event.stopPropagation()}>
        <DrawerHeaderRow
          className="-mx-5 -mt-5 mb-2 px-4 pt-3 pb-2 md:hidden"
          onCancel={onClose}
          onSave={() => onSave(value)}
          canSave={canSave}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="rounded-app-badge border border-app-line bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-faint">
            {new Date(startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(":00", "").replace(/\s+/g, "")}
          </div>
          <SaveShortcutHint className="hidden text-sm md:inline" />
        </div>
        <div className="mt-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onPaste={(event) => {
              handlePasteAsLink(event, value, setValue);
            }}
            onKeyDown={(event) => {
              if (hashtagPicker.handleKeyDown(event)) return;
              if (emojiPicker.handleKeyDown(event)) return;
              if (event.key !== "Enter") return;
              if (isSaveKeyEvent(event)) {
                event.preventDefault();
                onSave(value);
                return;
              }
              if (isNewlineKeyEvent(event)) {
                return;
              }
              event.preventDefault();
            }}
            rows={1}
            placeholder="Write your event"
            className="block w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-6 text-app-ink caret-app-ink outline-none placeholder:text-app-line-strong selection:bg-app-surface-muted selection:text-app-ink"
          />
          <p className="mt-1 text-xs text-app-ink-faint">{dateKey}</p>
        </div>
        <HashtagPickerDropdown
          isOpen={hashtagPicker.isOpen}
          suggestions={hashtagPicker.suggestions}
          activeIndex={hashtagPicker.activeIndex}
          onSelect={hashtagPicker.selectSuggestion}
          onHover={hashtagPicker.setActiveIndex}
          anchorRef={textareaRef}
        />
        <EmojiPickerDropdown
          isOpen={emojiPicker.isOpen}
          suggestions={emojiPicker.suggestions}
          activeIndex={emojiPicker.activeIndex}
          onSelect={emojiPicker.selectSuggestion}
          onHover={emojiPicker.setActiveIndex}
          anchorRef={textareaRef}
        />
      </div>
    </BaseModal>
  );
}
