import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteFolder, NoteItem } from "@omanote/shared";
import { Button, Input, TextArea } from "./ui";
import { RichTextToolbar, applyRichTextFormatToTextarea } from "./rich-text";
import { handlePasteAsLink } from "../lib/link-utils";
import { BaseModal } from "./BaseModal";
import { useHashtagPicker, HashtagPickerDropdown } from "./HashtagPicker";
import { useEmojiPicker, EmojiPickerDropdown } from "./EmojiPicker";
import { parseHashtags } from "../lib/hashtags";

const NOTE_LAST_FOLDER_KEY = "omanote.note-last-folder";

type NoteFolderMenuItem =
  | {
      kind: "existing";
      value: string;
      label: string;
    }
  | {
      kind: "create";
      value: string;
      label: string;
    };

function readLastNoteFolder() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NOTE_LAST_FOLDER_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeLastNoteFolder(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTE_LAST_FOLDER_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

function tagsToInput(tags: string[]) {
  return tags.join(", ");
}

function tagsFromInput(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function NoteEditorModal({
  note,
  folders,
  selectedFolderId,
  onClose,
  onSave,
  onDelete,
}: {
  note?: NoteItem | null;
  folders: NoteFolder[];
  selectedFolderId?: string | null;
  onClose: () => void;
  onSave: (payload: { body: string; tags: string[]; hashtags: string[]; folderName?: string; folderId?: string }) => void;
  onDelete?: () => void;
}) {
  const [body, setBody] = useState(note?.body ?? "");
  const [tags, setTags] = useState(tagsToInput(note?.tags ?? []));
  const initialFolderName = useMemo(() => {
    if (note?.folderId) {
      const folder = folders.find((item) => item.id === note.folderId);
      if (folder) return folder.name;
    }
    if (note) {
      return note.folderName ?? "";
    }
    if (selectedFolderId) {
      const folder = folders.find((item) => item.id === selectedFolderId);
      if (folder) return folder.name;
    }
    return readLastNoteFolder() ?? "";
  }, [folders, note?.folderId, note?.folderName, selectedFolderId]);
  const [folderName, setFolderName] = useState(initialFolderName);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderActiveIndex, setFolderActiveIndex] = useState(0);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const hashtagPicker = useHashtagPicker({
    value: body,
    textareaRef: bodyRef,
    onChange: setBody,
  });
  const emojiPicker = useEmojiPicker({
    value: body,
    textareaRef: bodyRef,
    onChange: setBody,
  });

  const folderValue = folderName.trim();
  const folderSuggestions = useMemo(() => {
    const nextFolders = [...new Set(folders.map((folder) => folder.name.trim()).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    );
    if (!folderValue) return nextFolders;
    return nextFolders.filter((folder) => folder.toLowerCase().includes(folderValue.toLowerCase()));
  }, [folders, folderValue]);
  const exactFolderMatch = useMemo(
    () => folders.find((folder) => folder.name.trim().toLowerCase() === folderValue.toLowerCase()) ?? null,
    [folders, folderValue],
  );
  const folderItems = useMemo(() => {
    const items: NoteFolderMenuItem[] = folderSuggestions.map((folder) => ({ kind: "existing" as const, value: folder, label: folder }));
    if (folderValue && !exactFolderMatch) {
      items.push({ kind: "create" as const, value: folderValue, label: `Create folder "${folderValue}"` });
    }
    return items;
  }, [exactFolderMatch, folderSuggestions, folderValue]);

  useEffect(() => {
    setBody(note?.body ?? "");
    setTags(tagsToInput(note?.tags ?? []));
    setFolderName(initialFolderName);
    setFolderOpen(false);
    setFolderActiveIndex(0);
  }, [initialFolderName, note]);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.style.height = "auto";
    bodyRef.current.style.height = `${bodyRef.current.scrollHeight}px`;
  }, [body]);

  const canSave = Boolean(body.trim());

  return (
    <BaseModal onClose={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-app-line bg-app-surface p-5 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-app-ink">{note ? "Edit note" : "Create note"}</h2>
              <p className="mt-1 text-sm text-app-ink-faint">Keep it lightweight. Notes support markdown shortcuts and a small formatting toolbar.</p>
            </div>
            <Button tone="ghost" onClick={onClose}>
              Close
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-app-ink-faint">Folder</p>
              <Input
                ref={folderInputRef}
                value={folderName}
                onChange={(event) => {
                  setFolderName(event.target.value);
                  setFolderOpen(true);
                  setFolderActiveIndex(0);
                }}
                onFocus={() => setFolderOpen(true)}
                onKeyDown={(event) => {
                  if (!folderOpen) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setFolderActiveIndex((current) => Math.min(current + 1, Math.max(0, folderItems.length - 1)));
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setFolderActiveIndex((current) => Math.max(current - 1, 0));
                    return;
                  }
                  if (event.key === "Enter" || event.key === "Tab") {
                    if (folderItems[folderActiveIndex]) {
                      event.preventDefault();
                      const nextFolder = folderItems[folderActiveIndex].value;
                      setFolderName(nextFolder);
                      setFolderOpen(false);
                      return;
                    }
                  }
                  if (event.key === "Escape") {
                    setFolderOpen(false);
                  }
                }}
                placeholder="Uncategorized"
              />
              {folderOpen && folderItems.length ? (
                <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-2xl border border-app-line bg-app-surface p-1 shadow-app-menu">
                  {folderItems.map((item, index) => (
                    <button
                      key={`${item.kind}:${item.value}`}
                      type="button"
                      onMouseEnter={() => setFolderActiveIndex(index)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setFolderName(item.value);
                        setFolderOpen(false);
                        folderInputRef.current?.focus();
                      }}
                      className={[
                        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                        index === folderActiveIndex ? "bg-action-primary text-white" : "hover:bg-app-surface-hover hover:text-app-ink",
                      ].join(" ")}
                    >
                      <span>{item.label}</span>
                      {item.kind === "create" ? <span className={index === folderActiveIndex ? "text-white/70" : "text-app-ink-faint"}>New</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-md border border-app-line bg-app-surface">
              <div className="sticky top-0 z-10 border-b border-app-line bg-app-surface/95 px-3 py-2 backdrop-blur">
                <RichTextToolbar textareaRef={bodyRef} onValueChange={setBody} className="flex-nowrap" />
              </div>
              <div className="relative">
                <TextArea
                  ref={bodyRef}
                  rows={12}
                  value={body}
                  onChange={(event) => {
                    setBody(event.target.value);
                    event.currentTarget.style.height = "auto";
                    event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                  }}
                  onPaste={(event) => {
                    handlePasteAsLink(event, body, setBody);
                  }}
                  onInput={(event) => {
                    event.currentTarget.style.height = "auto";
                    event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                  }}
                  onClick={() => {
                    if (bodyRef.current) bodyRef.current.dispatchEvent(new Event("selectionchange"));
                  }}
                  onKeyUp={() => {
                    if (bodyRef.current) bodyRef.current.dispatchEvent(new Event("selectionchange"));
                  }}
                  onKeyDown={(event) => {
                    if (hashtagPicker.handleKeyDown(event)) return;
                    if (emojiPicker.handleKeyDown(event)) return;
                    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
                      event.preventDefault();
                      applyRichTextFormatToTextarea(bodyRef.current!, "bold", setBody);
                    }
                    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
                      event.preventDefault();
                      applyRichTextFormatToTextarea(bodyRef.current!, "italic", setBody);
                    }
                  }}
                  placeholder="Write your note here"
                  className="min-h-[280px] resize-none rounded-none border-0 px-3 py-3 shadow-none focus:border-0"
                />
                <HashtagPickerDropdown
                  isOpen={hashtagPicker.isOpen}
                  suggestions={hashtagPicker.suggestions}
                  activeIndex={hashtagPicker.activeIndex}
                  onSelect={hashtagPicker.selectSuggestion}
                  onHover={hashtagPicker.setActiveIndex}
                  anchorRef={bodyRef}
                />
                <EmojiPickerDropdown
                  isOpen={emojiPicker.isOpen}
                  suggestions={emojiPicker.suggestions}
                  activeIndex={emojiPicker.activeIndex}
                  onSelect={emojiPicker.selectSuggestion}
                  onHover={emojiPicker.setActiveIndex}
                  anchorRef={bodyRef}
                />
              </div>
            </div>

            <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags, comma separated" />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button
              disabled={!canSave}
              onClick={() => {
                if (!note && folderValue) writeLastNoteFolder(folderValue);
                const trimmedBody = body.trim();
                onSave({
                  body: trimmedBody,
                  tags: tagsFromInput(tags),
                  hashtags: parseHashtags(trimmedBody),
                  folderId: exactFolderMatch?.id,
                  folderName: folderValue || undefined,
                });
              }}
            >
              Save
            </Button>
            <Button tone="ghost" onClick={onClose}>
              Cancel
            </Button>
            {note && onDelete ? (
              <Button tone="ghost" className="ml-auto text-app-ink-muted" onClick={onDelete}>
                Delete
              </Button>
            ) : null}
          </div>
        </div>
    </BaseModal>
  );
}
