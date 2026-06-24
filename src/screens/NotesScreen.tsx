import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDrawerDrag } from "../lib/useDrawerDrag";
import { ArrowDown, ArrowUp, ArrowUpDown, GripHorizontal, LayoutGrid, LayoutList, Plus } from "lucide-react";
import type { NoteItem } from "@omanote/shared";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useApp } from "../app/AppProvider";
import { EmptyState } from "../components/EmptyState";
import { FolderActionMenu, FolderCard, FolderRow } from "../components/NoteFolderNav";
import { BookmarkCategoryIconPicker } from "../components/BookmarkCategoryIconPicker";
import { CategoryIconView } from "../lib/bookmark-category-icon";
import { NoteCard } from "../components/cards";
import { useTopChrome } from "../components/layout/useTopChrome";
import { PageHeader } from "../components/layout/PageHeader";
import { Button, cn } from "../components/ui";
import { useOutsideClick } from "../lib/useOutsideClick";
import { ModalPortal } from "../components/ModalPortal";
import { BaseModal } from "../components/BaseModal";
import { NoteInlineEditor } from "../components/NoteInlineEditor";
import { ShareNoteFolderModal } from "../components/ShareNoteFolderModal";
import { UNCATEGORIZED_FOLDER_LABEL, isUncategorizedFolderName, normalizeNoteFolderName } from "../lib/note-folder-utils";
import { extractAllPreviewableUrls } from "../lib/attachment-link-preview";
import { captureScrollSnapshot, restoreScrollForNextFrames } from "../lib/preserve-focus-scroll";
import { resolveRichTextSourceOffsetFromPoint } from "../lib/rich-text-caret";

type FolderSortKey = "alphabetical" | "lastUpdated" | "totalNotes";
type FolderSortDirection = "asc" | "desc";
type FolderViewMode = "list" | "gallery";
const NOTES_LAST_SELECTED_FOLDER_KEY = "omanote.notes-last-selected-folder";
const NOTES_FOLDER_SORT_KEY = "omanote.notes-folder-sort";
const NOTES_FOLDER_VIEW_MODE_KEY = "omanote.notes-folder-view-mode";
const DEFAULT_FOLDER_SORT: { key: FolderSortKey; direction: FolderSortDirection } = { key: "lastUpdated", direction: "desc" };
const DEFAULT_FOLDER_VIEW_MODE: FolderViewMode = "list";

function readLastSelectedNotesFolder() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NOTES_LAST_SELECTED_FOLDER_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeLastSelectedNotesFolder(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTES_LAST_SELECTED_FOLDER_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

function isFolderSortKey(value: string): value is FolderSortKey {
  return value === "alphabetical" || value === "lastUpdated" || value === "totalNotes";
}

function isSortDirection(value: string): value is FolderSortDirection {
  return value === "asc" || value === "desc";
}

function readSavedFolderSort() {
  if (typeof window === "undefined") return DEFAULT_FOLDER_SORT;
  try {
    const raw = window.localStorage.getItem(NOTES_FOLDER_SORT_KEY);
    if (!raw) return DEFAULT_FOLDER_SORT;
    const [key, direction] = raw.split(":");
    if (!isFolderSortKey(key) || !isSortDirection(direction)) return DEFAULT_FOLDER_SORT;
    return { key, direction };
  } catch {
    return DEFAULT_FOLDER_SORT;
  }
}

function writeSavedFolderSort(value: { key: FolderSortKey; direction: FolderSortDirection }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTES_FOLDER_SORT_KEY, `${value.key}:${value.direction}`);
  } catch {
    // Ignore storage failures.
  }
}

function isFolderViewMode(value: string): value is FolderViewMode {
  return value === "list" || value === "gallery";
}

function readSavedFolderViewMode() {
  if (typeof window === "undefined") return DEFAULT_FOLDER_VIEW_MODE;
  try {
    const raw = window.localStorage.getItem(NOTES_FOLDER_VIEW_MODE_KEY);
    if (!raw || !isFolderViewMode(raw)) return DEFAULT_FOLDER_VIEW_MODE;
    return raw;
  } catch {
    return DEFAULT_FOLDER_VIEW_MODE;
  }
}

function writeSavedFolderViewMode(value: FolderViewMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTES_FOLDER_VIEW_MODE_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

function noteFolderName(note: NoteItem, folderNameById: Map<string, string>) {
  if (note.folderId && folderNameById.has(note.folderId)) {
    return folderNameById.get(note.folderId)!;
  }
  return note.folderName?.trim() || UNCATEGORIZED_FOLDER_LABEL;
}

function sortLabel(sortKey: FolderSortKey) {
  if (sortKey === "alphabetical") return "Alphabetically";
  if (sortKey === "lastUpdated") return "Last updated";
  return "Total notes";
}

function formatFolderDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function NotesScreen() {
  const { state, dispatch } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteSelectionStart, setEditingNoteSelectionStart] = useState<number | undefined>(undefined);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [composerResetKey, setComposerResetKey] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(() => readLastSelectedNotesFolder() || null);
  const [mobileNotesOpen, setMobileNotesOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [editingIcon, setEditingIcon] = useState<string | undefined>(undefined);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconPickerAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [directIconFolderId, setDirectIconFolderId] = useState<string | null>(null);
  const drawerDirectIconButtonRef = useRef<HTMLButtonElement>(null);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const [folderMenuOpenId, setFolderMenuOpenId] = useState<string | null>(null);
  const [drawerFolderMenuOpen, setDrawerFolderMenuOpen] = useState(false);
  const [drawerRenaming, setDrawerRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; count: number } | null>(null);
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string; icon?: string } | null>(null);
  const [folderSort, setFolderSort] = useState<{ key: FolderSortKey; direction: FolderSortDirection }>(() => readSavedFolderSort());
  const [folderViewMode, setFolderViewMode] = useState<FolderViewMode>(() => readSavedFolderViewMode());
  const effectiveFolderViewMode: FolderViewMode =
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches ? "list" : folderViewMode;
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const folderMenuRef = useRef<HTMLDivElement | null>(null);
  const drawerFolderMenuRef = useRef<HTMLDivElement | null>(null);
  const composerRootRef = useRef<HTMLDivElement | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement | null>(null);
  const drawerRenameInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFolderRenameRef = useRef<string | null>(null);
  const restoreNotesEditScrollRef = useRef<(() => void) | null>(null);
  const { dragOffset, isDragging, dragHandleProps } = useDrawerDrag(() => setMobileNotesOpen(false));

  useOutsideClick(sortMenuRef, sortMenuOpen, () => setSortMenuOpen(false));
  useOutsideClick(folderMenuRef, Boolean(folderMenuOpenId), () => setFolderMenuOpenId(null));
  useOutsideClick(drawerFolderMenuRef, drawerFolderMenuOpen, () => setDrawerFolderMenuOpen(false));

  useLayoutEffect(() => {
    if (!editingNoteId || !restoreNotesEditScrollRef.current) return;
    const cleanup = restoreScrollForNextFrames(restoreNotesEditScrollRef.current);
    restoreNotesEditScrollRef.current = null;
    return cleanup;
  }, [editingNoteId]);

  useEffect(() => {
    dispatch({ type: "ui/set-notes-drawer-open", open: mobileNotesOpen });
    return () => {
      dispatch({ type: "ui/set-notes-drawer-open", open: false });
    };
  }, [dispatch, mobileNotesOpen]);

  const activeSharedFolderIds = useQuery(api.sharedNoteFolders.listMyActiveFolderIds);
  const sharedFolderIdSet = useMemo(() => new Set(activeSharedFolderIds ?? []), [activeSharedFolderIds]);

  const updateShareSnapshot = useMutation(api.sharedNoteFolders.updateShareSnapshot);
  const noteSnapshotDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeSharedFolderIds?.length) return;
    if (noteSnapshotDebounceRef.current !== null) {
      window.clearTimeout(noteSnapshotDebounceRef.current);
    }
    noteSnapshotDebounceRef.current = window.setTimeout(() => {
      noteSnapshotDebounceRef.current = null;
      for (const folderId of activeSharedFolderIds) {
        const folder = state.noteFolders.find((f) => f.id === folderId);
        if (!folder) continue;
        const notes = state.notes
          .filter((n) => n.folderId === folderId && !n.deletedAt)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            tags: n.tags,
          }));
        void updateShareSnapshot({
          folderId: folderId as Id<"noteFolders">,
          folderName: folder.name,
          folderIcon: folder.icon,
          notes,
        });
      }
    }, 2000);
    return () => {
      if (noteSnapshotDebounceRef.current !== null) {
        window.clearTimeout(noteSnapshotDebounceRef.current);
      }
    };
  }, [state.notes, state.noteFolders, activeSharedFolderIds, updateShareSnapshot]);

  const activeNotes = state.notes;
  const sourceNotes = activeNotes;
  const folderNameById = useMemo(() => new Map(state.noteFolders.map((folder) => [folder.id, folder.name] as const)), [state.noteFolders]);
  const folderIconById = useMemo(() => new Map(state.noteFolders.map((folder) => [folder.id, folder.icon] as const)), [state.noteFolders]);

  const allFolderNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const folder of state.noteFolders) {
      names.set(normalizeNoteFolderName(folder.name), folder.name);
    }
    for (const note of sourceNotes) {
      const folder = noteFolderName(note, folderNameById);
      names.set(normalizeNoteFolderName(folder), folder);
    }
    return [...names.values()];
  }, [folderNameById, sourceNotes, state.noteFolders]);

  const duplicateFolderExists = useMemo(() => {
    const normalized = normalizeNoteFolderName(newFolderName);
    if (!normalized) return false;
    if (isUncategorizedFolderName(newFolderName)) return true;
    return allFolderNames.some((folderName) => {
      if (renamingFolderId) {
        const currentFolder = state.noteFolders.find((folder) => folder.id === renamingFolderId);
        if (currentFolder && normalizeNoteFolderName(currentFolder.name) === normalized) return false;
      }
      return normalizeNoteFolderName(folderName) === normalized;
    });
  }, [allFolderNames, newFolderName, renamingFolderId, state.noteFolders]);

  const folderRows = useMemo(() => {
    const rows = new Map<string, { id?: string; name: string; icon?: string; count: number; lastUpdated: number }>();
    for (const folder of state.noteFolders) {
      rows.set(normalizeNoteFolderName(folder.name), {
        id: folder.id,
        name: folder.name,
        icon: folder.icon,
        count: 0,
        lastUpdated: folder.createdAt,
      });
    }
    for (const note of sourceNotes) {
      const name = noteFolderName(note, folderNameById);
      const key = normalizeNoteFolderName(name);
      const existing = rows.get(key);
      if (existing) {
        existing.name = name;
        existing.count += 1;
        existing.lastUpdated = Math.max(existing.lastUpdated, note.updatedAt);
      } else {
        rows.set(key, {
          name,
          count: 1,
          lastUpdated: note.updatedAt,
        });
      }
    }

    return [...rows.values()].sort((left, right) => {
      let comparison = 0;
      if (folderSort.key === "alphabetical") {
        comparison = left.name.localeCompare(right.name);
      } else if (folderSort.key === "lastUpdated") {
        comparison = left.lastUpdated - right.lastUpdated;
      } else {
        comparison = left.count - right.count;
      }

      if (comparison === 0) {
        comparison = left.name.localeCompare(right.name);
      }

      return folderSort.direction === "asc" ? comparison : -comparison;
    });
  }, [folderNameById, folderSort.direction, folderSort.key, sourceNotes, state.noteFolders]);

  const visibleFolderRows = folderRows;

  useEffect(() => {
    if (!creatingFolder && !renamingFolderId) return;
    if (drawerRenaming) {
      drawerRenameInputRef.current?.focus();
      return;
    }
    newFolderInputRef.current?.focus();
  }, [creatingFolder, renamingFolderId, drawerRenaming]);

  useEffect(() => {
    if (!allFolderNames.length) {
      if (selectedFolder !== null) setSelectedFolder(null);
      return;
    }

    if (!selectedFolder) {
      setSelectedFolder(visibleFolderRows.find((folder) => folder.count > 0)?.name ?? visibleFolderRows[0]?.name ?? allFolderNames[0] ?? null);
      return;
    }

    // While a rename is in-flight (Convex mutation + async decryption), the new
    // name won't appear in allFolderNames yet. Suppress the reset until it does
    // so the selection doesn't jump to the first folder.
    if (pendingFolderRenameRef.current !== null) {
      const pending = pendingFolderRenameRef.current;
      if (allFolderNames.some((fn) => normalizeNoteFolderName(fn) === normalizeNoteFolderName(pending))) {
        pendingFolderRenameRef.current = null;
      } else {
        return;
      }
    }

    const exists = allFolderNames.some((folderName) => normalizeNoteFolderName(folderName) === normalizeNoteFolderName(selectedFolder));
    if (!exists) {
      setSelectedFolder(visibleFolderRows.find((folder) => folder.count > 0)?.name ?? visibleFolderRows[0]?.name ?? allFolderNames[0] ?? null);
    }
  }, [allFolderNames, selectedFolder, visibleFolderRows]);

  useEffect(() => {
    if (!selectedFolder) return;
    writeLastSelectedNotesFolder(selectedFolder);
  }, [selectedFolder]);

  useEffect(() => {
    writeSavedFolderSort(folderSort);
  }, [folderSort]);

  useEffect(() => {
    writeSavedFolderViewMode(folderViewMode);
  }, [folderViewMode]);

  const visibleNotes = useMemo(() => {
    if (!selectedFolder) return [];
    const filtered = sourceNotes.filter(
      (note) => normalizeNoteFolderName(noteFolderName(note, folderNameById)) === normalizeNoteFolderName(selectedFolder),
    );
    return [...filtered].sort((left, right) => {
      const comparison = left.createdAt - right.createdAt;
      if (comparison !== 0) return comparison;
      return left.updatedAt - right.updatedAt;
    });
  }, [folderNameById, selectedFolder, sourceNotes]);

  const selectedFolderRecord = useMemo(() => {
    if (!selectedFolder || isUncategorizedFolderName(selectedFolder)) return null;
    return state.noteFolders.find((folder) => normalizeNoteFolderName(folder.name) === normalizeNoteFolderName(selectedFolder)) ?? null;
  }, [selectedFolder, state.noteFolders]);

  const selectedFolderSummary = useMemo(() => {
    if (!selectedFolderRecord) return null;
    const hashtags = new Set<string>();
    const links = new Set<string>();
    let latestUpdatedAt = selectedFolderRecord.updatedAt;

    for (const note of visibleNotes) {
      latestUpdatedAt = Math.max(latestUpdatedAt, note.updatedAt);
      for (const tag of note.tags) {
        const normalizedTag = tag.trim().toLowerCase();
        if (normalizedTag) hashtags.add(normalizedTag);
      }
      for (const url of extractAllPreviewableUrls(note.title, note.body)) {
        links.add(url);
      }
    }

    return {
      createdAt: selectedFolderRecord.createdAt,
      updatedAt: latestUpdatedAt,
      hashtagCount: hashtags.size,
      linkCount: links.size,
    };
  }, [selectedFolderRecord, visibleNotes]);

  const focusNoteId =
    typeof (location.state as { focusNoteId?: unknown } | null)?.focusNoteId === "string"
      ? (location.state as { focusNoteId: string }).focusNoteId
      : null;
  const selectedFolderLabel = selectedFolder ?? UNCATEGORIZED_FOLDER_LABEL;
  const showCreateComposer = creating;
  const notifyNotesScroll = () => {
    window.dispatchEvent(new Event("omanote:notes-scroll"));
  };
  const resetComposerDraft = () => {
    setComposerResetKey((current) => current + 1);
  };
  const openFolderNotes = (folderName: string) => {
    setEditingNoteId(null);
    setEditingNoteSelectionStart(undefined);
    setSelectedFolder(folderName);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileNotesOpen(true);
    }
  };

  const startEditingNote = (note: NoteItem, event?: React.MouseEvent<HTMLElement>) => {
    if (event) {
      restoreNotesEditScrollRef.current = captureScrollSnapshot(event.currentTarget);
      setEditingNoteSelectionStart(resolveRichTextSourceOffsetFromPoint(event.currentTarget.ownerDocument, event.clientX, event.clientY, note.body));
    } else {
      setEditingNoteSelectionStart(undefined);
    }
    setEditingNoteId(note.id);
  };

  const renderCreateComposer = (suppressToolbar: boolean) => (
    <div ref={composerRootRef} className="relative z-20 pt-6">
      <NoteInlineEditor
        key={composerResetKey}
        folders={state.noteFolders}
        defaultFolderName={selectedFolder ?? undefined}
        selectedFolderId={
          selectedFolder && !isUncategorizedFolderName(selectedFolder)
            ? state.noteFolders.find((folder) => normalizeNoteFolderName(folder.name) === normalizeNoteFolderName(selectedFolder))?.id ?? null
            : null
        }
        autoFocus={creating}
        layout="canvas"
        showTags={false}
        hideFolderPicker
        suppressToolbar={suppressToolbar}
        saveOnOutsideClick
        persistRecentFolderOnSave
        onCancel={() => {
          resetComposerDraft();
          setCreating(false);
        }}
        onSave={(payload) => {
          dispatch({
            type: "note/create",
            body: payload.body,
            tags: payload.tags,
            hashtags: payload.hashtags,
            folderId: payload.folderId,
            folderName: payload.folderName,
            dateKey: state.ui.selectedDateKey,
          });
          resetComposerDraft();
          setCreating(false);
        }}
      />
    </div>
  );

  const commitNewFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setCreatingFolder(false);
      setRenamingFolderId(null);
      setNewFolderName("");
      setNewFolderError(null);
      setEditingIcon(undefined);
      setIconPickerOpen(false);
      return;
    }
    if (duplicateFolderExists) {
      setNewFolderError(isUncategorizedFolderName(trimmed) ? `"${UNCATEGORIZED_FOLDER_LABEL}" is reserved` : "Folder name already exists");
      return;
    }
    if (renamingFolderId) {
      dispatch({ type: "note-folder/update", folderId: renamingFolderId, name: trimmed, icon: editingIcon });
      pendingFolderRenameRef.current = trimmed;
      if (selectedFolder) {
        setSelectedFolder(trimmed);
      }
    } else {
      dispatch({ type: "note-folder/create", name: trimmed, icon: editingIcon });
      setSelectedFolder(trimmed);
    }
    setCreatingFolder(false);
    setRenamingFolderId(null);
    setFolderMenuOpenId(null);
    setNewFolderName("");
    setNewFolderError(null);
    setEditingIcon(undefined);
    setIconPickerOpen(false);
    setDrawerRenaming(false);
  };

  const cancelNewFolder = () => {
    setCreatingFolder(false);
    setRenamingFolderId(null);
    setNewFolderName("");
    setNewFolderError(null);
    setEditingIcon(undefined);
    setIconPickerOpen(false);
    setDrawerRenaming(false);
  };

  const commitNewFolderOnBlur = () => {
    if (duplicateFolderExists) { cancelNewFolder(); return; }
    commitNewFolder();
  };

  const toggleSort = (nextKey: FolderSortKey) => {
    setFolderSort((current) =>
      current.key === nextKey
        ? { key: nextKey, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key: nextKey, direction: "desc" },
    );
    setSortMenuOpen(false);
  };

  const topChrome = useMemo(() => <PageHeader stat="notes_this_week" />, []);
  useTopChrome(topChrome);

  useEffect(() => {
    if (!focusNoteId) return;
    const targetNote = state.notes.find((note) => note.id === focusNoteId);
    if (!targetNote) return;
    setSelectedFolder(noteFolderName(targetNote, folderNameById));
    setEditingNoteId(null);
    setFocusedNoteId(focusNoteId);
    navigate(location.pathname, { replace: true, state: null });
  }, [focusNoteId, folderNameById, location.pathname, navigate, state.notes]);

  useEffect(() => {
    if (!focusedNoteId) return;
    const highlightTimeout = window.setTimeout(() => {
      setFocusedNoteId((current) => (current === focusedNoteId ? null : current));
    }, 2600);
    const scrollTimeout = window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-note-row-id="${focusedNoteId}"]`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    return () => {
      window.clearTimeout(highlightTimeout);
      window.clearTimeout(scrollTimeout);
    };
  }, [focusedNoteId, visibleNotes]);

  const renderNotesPanel = (isMobileDrawer = false) => {
    const suppressToolbar = isMobileDrawer ? isDesktop || !mobileNotesOpen : !isDesktop;

    return (
      <div className="flex h-full min-h-0 flex-col lg:pl-8 lg:pt-4">
      <div className="flex flex-col lg:hidden" {...dragHandleProps}>
        <div className="flex items-center justify-center px-4 pt-3 pb-2">
          <GripHorizontal className="h-5 w-5 text-app-line-strong" />
        </div>
        {isMobileDrawer && drawerRenaming ? (
          <div className="relative mb-3 flex items-center gap-2 border-b border-app-line px-4 pb-3">
            <button
              ref={iconPickerAnchorRef}
              type="button"
              aria-label="Change icon"
              onMouseDown={(e) => { e.preventDefault(); setIconPickerOpen(true); }}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-app-surface-muted text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
            >
              <CategoryIconView icon={editingIcon} size="sm" />
            </button>
            <input
              ref={drawerRenameInputRef}
              value={newFolderName}
              onChange={(e) => { setNewFolderName(e.target.value); setNewFolderError(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitNewFolder(); }
                else if (e.key === "Escape") { e.preventDefault(); cancelNewFolder(); }
              }}
              onBlur={iconPickerOpen ? undefined : commitNewFolderOnBlur}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold text-app-ink outline-none placeholder:text-app-ink-faint"
            />
            {newFolderError ? (
              <div className="absolute left-14 top-full z-app-tooltip mt-2 rounded-md border border-danger-line bg-app-surface px-2 py-1 text-xs text-danger-ink shadow-soft">
                {newFolderError}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-app-line px-4 pb-3">
            <div className="flex min-w-0 items-center gap-2">
              {(() => {
                const row = visibleFolderRows.find(
                  (f) => selectedFolder && normalizeNoteFolderName(f.name) === normalizeNoteFolderName(selectedFolder),
                );
                if (row?.id) {
                  return (
                    <button
                      ref={drawerDirectIconButtonRef}
                      type="button"
                      aria-label="Change icon"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setDirectIconFolderId(row.id!);
                        setEditingIcon(row.icon);
                        iconPickerAnchorRef.current = drawerDirectIconButtonRef.current;
                        setIconPickerOpen(true);
                      }}
                      className="flex-shrink-0 rounded-md p-0.5 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                    >
                      <CategoryIconView icon={row.icon} size="sm" />
                    </button>
                  );
                }
                return (
                  <span className="flex-shrink-0 text-app-ink-faint">
                    <CategoryIconView icon={row?.icon} size="sm" />
                  </span>
                );
              })()}
              <p className="min-w-0 truncate text-sm font-bold text-app-ink">{selectedFolderLabel}</p>
            </div>
            {isMobileDrawer && (() => {
              const row = visibleFolderRows.find(
                (f) => selectedFolder && normalizeNoteFolderName(f.name) === normalizeNoteFolderName(selectedFolder),
              );
              if (!row?.id) return null;
              return (
                <FolderActionMenu
                  folderId={row.id}
                  folderName={row.name}
                  isOpen={drawerFolderMenuOpen}
                  menuRef={drawerFolderMenuOpen ? drawerFolderMenuRef : undefined}
                  size="md"
                  alwaysVisible
                  onToggle={() => setDrawerFolderMenuOpen((current) => !current)}
                  isShared={row.id ? sharedFolderIdSet.has(row.id) : false}
                  onRename={() => {
                    setRenamingFolderId(row.id ?? null);
                    setNewFolderName(row.name);
                    setEditingIcon(row.id ? folderIconById.get(row.id) : undefined);
                    setNewFolderError(null);
                    setDrawerFolderMenuOpen(false);
                    setDrawerRenaming(true);
                  }}
                  onShare={() => {
                    setShareTarget({ id: row.id ?? "", name: row.name, icon: row.icon });
                    setDrawerFolderMenuOpen(false);
                  }}
                  onDelete={() => {
                    setDeleteTarget({ id: row.id ?? "", name: row.name, count: row.count });
                    setDrawerFolderMenuOpen(false);
                  }}
                />
              );
            })()}
          </div>
        )}
      </div>
      <div className={cn("mb-3 flex items-center justify-between gap-3", isMobileDrawer && "px-4")}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {selectedFolderSummary ? (
            <div className="flex min-w-0 flex-wrap items-center gap-y-1 text-[11px] text-app-ink-faint">
              <span>Created {formatFolderDate(selectedFolderSummary.createdAt)}</span>
              <span className="px-2" aria-hidden="true">
                ·
              </span>
              <span>Updated {formatFolderDate(selectedFolderSummary.updatedAt)}</span>
              <span className="px-2" aria-hidden="true">
                ·
              </span>
              <span>{selectedFolderSummary.hashtagCount} {selectedFolderSummary.hashtagCount === 1 ? "hashtag" : "hashtags"}</span>
              <span className="px-2" aria-hidden="true">
                ·
              </span>
              <span>{selectedFolderSummary.linkCount} {selectedFolderSummary.linkCount === 1 ? "link" : "links"}</span>
            </div>
          ) : null}
        </div>
      </div>
      {visibleNotes.length ? (
        <div
          className={cn("min-h-0 flex-1 space-y-1.5 overflow-y-auto", isMobileDrawer && "px-4")}
          style={{ overflowAnchor: "none" }}
          onScroll={notifyNotesScroll}
        >
          {visibleNotes.map((note) => (
            <div
              key={note.id}
              data-note-row-id={note.id}
              className={cn(
                focusedNoteId === note.id && editingNoteId !== note.id
                  ? "rounded-xl bg-info-surface/60 ring-1 ring-info-line transition duration-300"
                  : "",
              )}
            >
              {editingNoteId === note.id ? (
                <div className="group relative px-1 py-1">
                  <NoteInlineEditor
                    note={note}
                    folders={state.noteFolders}
                    selectedFolderId={note.folderId ?? null}
                    autoFocus
                    initialSelectionStart={editingNoteSelectionStart}
                    layout="canvas"
                    showTags={false}
                    suppressToolbar={suppressToolbar}
                    saveOnOutsideClick
                    onCancel={() => {
                      setEditingNoteId(null);
                      setEditingNoteSelectionStart(undefined);
                    }}
                    onSave={(payload) => {
                      // Only dispatch if something actually changed — opening and
                      // closing without edits must not bump updatedAt or sort order.
                      const bodyChanged = payload.body !== note.body.trim();
                      const folderChanged =
                        payload.folderId !== note.folderId ||
                        (payload.folderName ?? "") !== (note.folderName?.trim() ?? "");
                      if (bodyChanged || folderChanged) {
                        dispatch({
                          type: "note/update",
                          noteId: note.id,
                          body: payload.body,
                          tags: payload.tags,
                          hashtags: payload.hashtags,
                          folderId: payload.folderId,
                          folderName: payload.folderName,
                        });
                      }
                      setEditingNoteId(null);
                      setEditingNoteSelectionStart(undefined);
                    }}
                  />
                </div>
              ) : (
                <NoteCard
                  note={note}
                  folderLabel={noteFolderName(note, folderNameById)}
                  surface="list"
                  expanded={false}
                  onToggleExpanded={() => undefined}
                  onEdit={startEditingNote}
                  onDelete={(noteId) => dispatch({ type: "note/delete", noteId })}
                />
              )}
            </div>
          ))}
          {renderCreateComposer(suppressToolbar)}
          <div aria-hidden="true" style={{ height: "calc(var(--omanote-bottom-nav-height, 64px) + 1.5rem)", flexShrink: 0 }} />
        </div>
      ) : (
        <div className={cn("min-h-0 flex-1 overflow-y-auto", isMobileDrawer && "px-4")} onScroll={notifyNotesScroll}>
          {renderCreateComposer(suppressToolbar)}
          <div className="flex min-h-[calc(100%-5rem)] items-center justify-center">
            <EmptyState
              title={selectedFolder ? `No notes in ${selectedFolderLabel}` : "No notes yet"}
              description={
                selectedFolder
                  ? "This folder is empty. Create a note or move an existing one into it."
                  : "Create a note from the button above or file one from the canvas."
              }
            />
          </div>
          <div aria-hidden="true" style={{ height: "calc(var(--omanote-bottom-nav-height, 64px) + 1.5rem)", flexShrink: 0 }} />
        </div>
      )}
    </div>
    );
  };

  return (
    <div
      className="fixed left-0 right-0 z-0 mx-auto flex min-h-0 flex-1 flex-col overflow-hidden md:px-4"
      style={{
        top: "var(--omanote-top-chrome-height, 0px)",
        bottom: "0px",
        maxWidth: "1200px",
      }}
    >
      <div className="relative grid h-full min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[284px_minmax(0,1fr)]">
        <aside className="h-full min-h-0 overflow-hidden pt-4">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                aria-label="Add folder"
                onClick={() => {
                  setCreatingFolder(true);
                  setNewFolderName("");
                  setNewFolderError(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-app-line bg-app-surface text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Plus className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md border border-app-line bg-app-surface lg:hidden">
                  <button
                    type="button"
                    aria-label="List view"
                    onClick={() => setFolderViewMode("list")}
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-l-md transition",
                      folderViewMode === "list"
                        ? "bg-app-surface-muted text-app-ink"
                        : "text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink-muted",
                    ].join(" ")}
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Gallery view"
                    onClick={() => setFolderViewMode("gallery")}
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-r-md transition",
                      folderViewMode === "gallery"
                        ? "bg-app-surface-muted text-app-ink"
                        : "text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink-muted",
                    ].join(" ")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              <div ref={sortMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="Sort folders"
                  onClick={() => setSortMenuOpen((open) => !open)}
                  className="flex h-8 items-center gap-1 rounded-md border border-app-line bg-app-surface px-2 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <span className="text-xs font-medium">{sortLabel(folderSort.key)}</span>
                  {folderSort.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                </button>
                {sortMenuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft">
                    {(["alphabetical", "lastUpdated", "totalNotes"] as FolderSortKey[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleSort(option)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                      >
                        <span>{sortLabel(option)}</span>
                        {folderSort.key === option ? (
                          folderSort.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              </div>
            </div>

            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto" onScroll={notifyNotesScroll}>
              {effectiveFolderViewMode === "gallery" ? (
                <div className="grid grid-cols-3 gap-2">
                  {creatingFolder ? (
                    <div className="col-span-3">
                      <FolderRow
                        folderName=""
                        icon={editingIcon}
                        count={0}
                        selected={false}
                        onClick={() => undefined}
                        isEditing
                        inputValue={newFolderName}
                        onInputChange={(value) => {
                          setNewFolderName(value);
                          setNewFolderError(null);
                        }}
                        onInputKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitNewFolder();
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            cancelNewFolder();
                          }
                        }}
                        inputRef={newFolderInputRef}
                        duplicateError={newFolderError}
                        onCancel={iconPickerOpen ? undefined : commitNewFolderOnBlur}
                        onIconClick={(ref) => { iconPickerAnchorRef.current = ref.current; setIconPickerOpen(true); }}
                      />
                    </div>
                  ) : null}

                  {visibleFolderRows.map((folder) => (
                    renamingFolderId === folder.id && !drawerRenaming ? (
                      <div key={folder.id ?? folder.name} className="col-span-3">
                        <FolderRow
                          folderName={folder.name}
                          icon={editingIcon}
                          count={folder.count}
                          selected={false}
                          onClick={() => undefined}
                          isEditing
                          inputValue={newFolderName}
                          onInputChange={(value) => {
                            setNewFolderName(value);
                            setNewFolderError(null);
                          }}
                          onInputKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitNewFolder();
                            } else if (event.key === "Escape") {
                              event.preventDefault();
                              cancelNewFolder();
                            }
                          }}
                          inputRef={newFolderInputRef}
                          duplicateError={newFolderError}
                          onCancel={iconPickerOpen ? undefined : commitNewFolderOnBlur}
                          placeholder={folder.name}
                          onIconClick={(ref) => { iconPickerAnchorRef.current = ref.current; setIconPickerOpen(true); }}
                        />
                      </div>
                    ) : (
                      <FolderCard
                        key={folder.id ?? folder.name}
                        folderName={folder.name}
                        icon={folder.icon}
                        count={folder.count}
                        selected={selectedFolder ? normalizeNoteFolderName(selectedFolder) === normalizeNoteFolderName(folder.name) : false}
                        onClick={() => openFolderNotes(folder.name)}
                        isShared={folder.id ? sharedFolderIdSet.has(folder.id) : false}
                        onIconClick={isDesktop && folder.id ? (ref) => {
                          setDirectIconFolderId(folder.id!);
                          setEditingIcon(folder.icon);
                          iconPickerAnchorRef.current = ref.current;
                          setIconPickerOpen(true);
                        } : () => openFolderNotes(folder.name)}
                        iconPickerActive={directIconFolderId === folder.id}
                        actions={
                          isDesktop && folder.id ? (
                            <FolderActionMenu
                              folderId={folder.id}
                              folderName={folder.name}
                              isOpen={folderMenuOpenId === folder.id}
                              menuRef={folderMenuOpenId === folder.id ? folderMenuRef : undefined}
                              size="sm"
                              isShared={sharedFolderIdSet.has(folder.id)}
                              onToggle={() => setFolderMenuOpenId((current) => (current === folder.id ? null : folder.id ?? null))}
                              onRename={() => {
                                setRenamingFolderId(folder.id ?? null);
                                setNewFolderName(folder.name);
                                setEditingIcon(folder.icon);
                                setNewFolderError(null);
                                setFolderMenuOpenId(null);
                              }}
                              onShare={() => {
                                setShareTarget({ id: folder.id ?? "", name: folder.name, icon: folder.icon });
                                setFolderMenuOpenId(null);
                              }}
                              onDelete={() => {
                                setDeleteTarget({ id: folder.id ?? "", name: folder.name, count: folder.count });
                                setFolderMenuOpenId(null);
                              }}
                            />
                          ) : null
                        }
                      />
                    )
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {creatingFolder ? (
                    <FolderRow
                      folderName=""
                      icon={editingIcon}
                      count={0}
                      selected={false}
                      onClick={() => undefined}
                      isEditing
                      inputValue={newFolderName}
                      onInputChange={(value) => {
                        setNewFolderName(value);
                        setNewFolderError(null);
                      }}
                      onInputKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitNewFolder();
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          cancelNewFolder();
                        }
                      }}
                      inputRef={newFolderInputRef}
                      duplicateError={newFolderError}
                      onCancel={iconPickerOpen ? undefined : commitNewFolderOnBlur}
                      onIconClick={(ref) => { iconPickerAnchorRef.current = ref.current; setIconPickerOpen(true); }}
                    />
                  ) : null}

                  {visibleFolderRows.map((folder) => (
                    renamingFolderId === folder.id && !drawerRenaming ? (
                      <FolderRow
                        key={folder.id ?? folder.name}
                        folderName={folder.name}
                        icon={editingIcon}
                        count={folder.count}
                        selected={false}
                        onClick={() => undefined}
                        isEditing
                        inputValue={newFolderName}
                        onInputChange={(value) => {
                          setNewFolderName(value);
                          setNewFolderError(null);
                        }}
                        onInputKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitNewFolder();
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            cancelNewFolder();
                          }
                        }}
                        inputRef={newFolderInputRef}
                        duplicateError={newFolderError}
                        onCancel={iconPickerOpen ? undefined : commitNewFolderOnBlur}
                        placeholder={folder.name}
                        onIconClick={(ref) => { iconPickerAnchorRef.current = ref.current; setIconPickerOpen(true); }}
                      />
                    ) : (
                      <FolderRow
                        key={folder.id ?? folder.name}
                        folderName={folder.name}
                        icon={folder.icon}
                        count={folder.count}
                        selected={selectedFolder ? normalizeNoteFolderName(selectedFolder) === normalizeNoteFolderName(folder.name) : false}
                        onClick={() => openFolderNotes(folder.name)}
                        isShared={folder.id ? sharedFolderIdSet.has(folder.id) : false}
                        onIconClick={isDesktop && folder.id ? (ref) => {
                          setDirectIconFolderId(folder.id!);
                          setEditingIcon(folder.icon);
                          iconPickerAnchorRef.current = ref.current;
                          setIconPickerOpen(true);
                        } : () => openFolderNotes(folder.name)}
                        iconPickerActive={directIconFolderId === folder.id}
                        actions={
                          isDesktop && folder.id ? (
                            <FolderActionMenu
                              folderId={folder.id}
                              folderName={folder.name}
                              isOpen={folderMenuOpenId === folder.id}
                              menuRef={folderMenuOpenId === folder.id ? folderMenuRef : undefined}
                              size="sm"
                              isShared={sharedFolderIdSet.has(folder.id)}
                              onToggle={() => setFolderMenuOpenId((current) => (current === folder.id ? null : folder.id ?? null))}
                              onRename={() => {
                                setRenamingFolderId(folder.id ?? null);
                                setNewFolderName(folder.name);
                                setEditingIcon(folder.icon);
                                setNewFolderError(null);
                                setFolderMenuOpenId(null);
                              }}
                              onShare={() => {
                                setShareTarget({ id: folder.id ?? "", name: folder.name, icon: folder.icon });
                                setFolderMenuOpenId(null);
                              }}
                              onDelete={() => {
                                setDeleteTarget({ id: folder.id ?? "", name: folder.name, count: folder.count });
                                setFolderMenuOpenId(null);
                              }}
                            />
                          ) : null
                        }
                      />
                    )
                  ))}
                </div>
              )}
              <div aria-hidden="true" style={{ height: "calc(var(--omanote-bottom-nav-height, 64px) + 1.5rem)", flexShrink: 0 }} />
            </div>
          </div>
        </aside>

        <section className="hidden min-h-0 flex-1 flex-col lg:flex lg:border-l lg:border-app-line">
          {renderNotesPanel(false)}
        </section>
      </div>

      <ModalPortal>
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-app-overlay bg-app-canvas/55 transform-gpu transition-opacity duration-app-drawer ease-app-drawer lg:hidden",
            mobileNotesOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileNotesOpen(false)}
        />
        <section
          className={cn(
            "fixed inset-x-0 bottom-0 z-app-drawer flex max-h-[92dvh] min-h-0 flex-col rounded-t-2xl bg-app-surface shadow-app-drawer transform-gpu lg:hidden",
            isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
            mobileNotesOpen ? "translate-y-0" : "pointer-events-none translate-y-full",
          )}
          style={isDragging || dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
        >
          {renderNotesPanel(true)}
        </section>
      </ModalPortal>

      {deleteTarget ? (
        <BaseModal onClose={() => setDeleteTarget(null)} zIndex="z-app-dialog">
          <div className="w-full max-w-md rounded-xl border border-app-line bg-app-surface p-5 shadow-soft">
            <h2 className="text-lg font-bold text-app-ink">{`Delete "${deleteTarget.name}"?`}</h2>
            <p className="mt-2 text-sm leading-6 text-app-ink-muted">
              {deleteTarget.count > 0
                ? `This folder contains ${deleteTarget.count} notes. You can delete the folder and keep the notes by moving them to Uncategorized, or delete the folder and all notes inside it.`
                : "This folder is empty. Deleting it will remove the folder."}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button tone="plain" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                {deleteTarget.count > 0 ? (
                  <Button
                    tone="dangerGhost"
                    onClick={() => {
                      dispatch({ type: "note-folder/delete-with-notes", folderId: deleteTarget.id });
                      setDeleteTarget(null);
                    }}
                  >
                    Delete folder and notes
                  </Button>
                ) : null}
                <Button
                  tone="default"
                  onClick={() => {
                    dispatch({ type: "note-folder/delete", folderId: deleteTarget.id });
                    setDeleteTarget(null);
                  }}
                >
                  {deleteTarget.count > 0 ? "Delete folder only" : "Delete folder"}
                </Button>
              </div>
            </div>
          </div>
        </BaseModal>
      ) : null}

      {shareTarget ? (
        <ShareNoteFolderModal
          folderId={shareTarget.id}
          folderName={shareTarget.name}
          folderIcon={shareTarget.icon}
          onClose={() => setShareTarget(null)}
        />
      ) : null}

      {iconPickerOpen ? (
        <BookmarkCategoryIconPicker
          key={directIconFolderId ?? renamingFolderId ?? "new"}
          anchorRef={iconPickerAnchorRef}
          currentIcon={editingIcon}
          onSelect={(icon) => {
            if (directIconFolderId) {
              const folder = state.noteFolders.find((f) => f.id === directIconFolderId);
              if (folder) dispatch({ type: "note-folder/update", folderId: directIconFolderId, name: folder.name, icon });
              setDirectIconFolderId(null);
              setEditingIcon(undefined);
            } else {
              setEditingIcon(icon);
            }
            setIconPickerOpen(false);
          }}
          onClose={() => {
            setIconPickerOpen(false);
            if (directIconFolderId) {
              setDirectIconFolderId(null);
              setEditingIcon(undefined);
            }
          }}
        />
      ) : null}
    </div>
  );
}
