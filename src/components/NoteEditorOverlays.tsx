import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { TiptapLinkPopover } from "./TiptapLinkPopover";
import { HashtagPickerDropdown } from "./HashtagPicker";
import { EmojiPickerDropdown } from "./EmojiPicker";
import type { useTiptapEmojiPicker, useTiptapHashtagPicker } from "../lib/tiptap-note";

/** The link popover and the #hashtag / :emoji: suggestion dropdowns shared by the note editors and PageEditor. */
export function NoteEditorOverlays({
  editor,
  wrapperRef,
  hashtagPicker,
  emojiPicker,
}: {
  editor: Editor | null;
  wrapperRef: RefObject<HTMLDivElement | null>;
  hashtagPicker: ReturnType<typeof useTiptapHashtagPicker>;
  emojiPicker: ReturnType<typeof useTiptapEmojiPicker>;
}) {
  return (
    <>
      <TiptapLinkPopover editor={editor} wrapperRef={wrapperRef} />
      <HashtagPickerDropdown
        isOpen={hashtagPicker.isOpen}
        suggestions={hashtagPicker.suggestions}
        activeIndex={hashtagPicker.activeIndex}
        onSelect={hashtagPicker.selectSuggestion}
        onHover={hashtagPicker.setActiveIndex}
        anchorRef={wrapperRef}
        anchorRect={hashtagPicker.anchorRect}
      />
      <EmojiPickerDropdown
        isOpen={emojiPicker.isOpen}
        suggestions={emojiPicker.suggestions}
        activeIndex={emojiPicker.activeIndex}
        onSelect={emojiPicker.selectSuggestion}
        onHover={emojiPicker.setActiveIndex}
        anchorRef={wrapperRef}
        anchorRect={emojiPicker.anchorRect}
      />
    </>
  );
}
