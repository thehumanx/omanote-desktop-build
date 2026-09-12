import { useEffect, useMemo, useRef, useState } from "react";
import { useEdgeSwipeBack } from "../lib/useEdgeSwipeBack";
import { useHistoryBackClose } from "../lib/useHistoryBackClose";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, Globe, LayoutGrid, LayoutList, MoreHorizontal, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import type { BookmarkCategory, BookmarkItem } from "@omanote/shared";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useApp } from "../app/AppProvider";
import { EmptyState } from "../components/EmptyState";
import { CategoryActionMenu, CategoryCard, CategoryRow } from "../components/BookmarkCategoryNav";
import { BookmarkCategoryIconPicker } from "../components/BookmarkCategoryIconPicker";
import { CategoryIconView } from "../lib/bookmark-category-icon";
import { BookmarkCard } from "../components/cards";
import { VirtualList, type VirtualListHandle } from "../components/VirtualList";
import { useTopChrome } from "../components/layout/useTopChrome";
import { ExpandableSearch } from "../components/ExpandableSearch";
import { matchesQuery, normalizeSearchQuery } from "../lib/search-match";
import { Button, cn } from "../components/ui";
import { BookmarkEditorModal } from "../components/BookmarkEditorModal";
import { ShareFolderModal } from "../components/ShareFolderModal";
import { useOutsideClick } from "../lib/useOutsideClick";
import { ModalPortal } from "../components/ModalPortal";
import { BaseModal } from "../components/BaseModal";
import {
  LINKED_ARTIFACT_SAVED_CATEGORY_ID,
  LINKED_ARTIFACT_GCAL_CATEGORY_ID,
  buildLinkedArtifactBookmarks,
  isLinkedArtifactBookmarkId,
  type LinkedArtifactReference,
} from "../lib/linked-artifact-bookmarks";
import { useIsDesktop, usePersistedEnum, usePersistedFolderSort, usePersistedFolderViewMode } from "../hooks/useFolderNavigation";

type BookmarkSortDirection = "asc" | "desc";
/** Module scope so it stays referentially stable across renders — VirtualList memoises its key map on it. */
const bookmarkRowKey = (bookmark: BookmarkItem) => bookmark.id;

type CategorySortKey = "alphabetical" | "lastUpdated" | "totalBookmarks";
type CategoryViewMode = "list" | "gallery";

const BOOKMARKS_LAST_SELECTED_CATEGORY_KEY = "omanote.bookmarks-last-selected-category";
const BOOKMARKS_CATEGORY_SORT_KEY = "omanote.bookmarks-category-sort";
const BOOKMARKS_ITEM_SORT_DIRECTION_KEY = "omanote.bookmarks-item-sort-direction";
const BOOKMARKS_CATEGORY_VIEW_MODE_KEY = "omanote.bookmarks-category-view-mode";
const DEFAULT_CATEGORY_SORT: { key: CategorySortKey; direction: BookmarkSortDirection } = { key: "lastUpdated", direction: "desc" };
const DEFAULT_BOOKMARK_SORT_DIRECTION: BookmarkSortDirection = "desc";
const DEFAULT_CATEGORY_VIEW_MODE: CategoryViewMode = "list";

function readLastSelectedBookmarkCategory() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(BOOKMARKS_LAST_SELECTED_CATEGORY_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeLastSelectedBookmarkCategory(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BOOKMARKS_LAST_SELECTED_CATEGORY_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

const CATEGORY_SORT_KEYS = ["alphabetical", "lastUpdated", "totalBookmarks"] as const;
const BOOKMARK_SORT_DIRECTIONS = ["asc", "desc"] as const;

function normalizeCategoryName(name: string) {
  return name.trim().toLowerCase();
}

function isSavedCategoryName(name: string) {
  return normalizeCategoryName(name) === "saved";
}

function isGcalCategoryName(name: string) {
  return normalizeCategoryName(name) === "synced from gcal";
}

function sortLabel(sortKey: CategorySortKey) {
  if (sortKey === "alphabetical") return "Alphabetically";
  if (sortKey === "lastUpdated") return "Last updated";
  return "Total bookmarks";
}

function bookmarkCategoryName(bookmark: BookmarkItem, categoryNameById: Map<string, string>) {
  return categoryNameById.get(bookmark.categoryId) ?? "Saved";
}

export function BookmarksScreen() {
  const { state, dispatch, googleImportedTodoIds } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [creating, setCreating] = useState(false);
  // Same BookmarkEditorModal on both desktop and mobile, scoped to the
  // selected category via noteCategoryIdForCreate below — doesn't touch
  // mobileBookmarksOpen, so the folder panel stays open underneath it.
  const handleCreateBookmark = () => {
    setCreating(true);
  };
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [editingIcon, setEditingIcon] = useState<string | undefined>(undefined);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconPickerAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [directIconCategoryId, setDirectIconCategoryId] = useState<string | null>(null);
  const drawerDirectIconButtonRef = useRef<HTMLButtonElement>(null);
  const isDesktop = useIsDesktop();
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [focusedBookmarkId, setFocusedBookmarkId] = useState<string | null>(null);
  // The desktop panel and the mobile drawer are both mounted at once, so each
  // gets its own handle and a jump is issued to both.
  const bookmarksListRefDesktop = useRef<VirtualListHandle>(null);
  const bookmarksListRefMobile = useRef<VirtualListHandle>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(() => readLastSelectedBookmarkCategory() || null);
  const [mobileBookmarksOpen, setMobileBookmarksOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);
  const [categoryMenuOpenId, setCategoryMenuOpenId] = useState<string | null>(null);
  const [drawerCategoryMenuOpen, setDrawerCategoryMenuOpen] = useState(false);
  const [drawerRenaming, setDrawerRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; count: number } | null>(null);
  const [shareFolderModal, setShareFolderModal] = useState<{ categoryId: string; categoryName: string; categoryIcon?: string } | null>(null);
  const [categorySort, setCategorySort] = usePersistedFolderSort(BOOKMARKS_CATEGORY_SORT_KEY, CATEGORY_SORT_KEYS, DEFAULT_CATEGORY_SORT);
  const [bookmarkSortDirection, setBookmarkSortDirection] = usePersistedEnum(
    BOOKMARKS_ITEM_SORT_DIRECTION_KEY,
    BOOKMARK_SORT_DIRECTIONS,
    DEFAULT_BOOKMARK_SORT_DIRECTION,
  );
  const [categoryViewMode, setCategoryViewMode] = usePersistedFolderViewMode(BOOKMARKS_CATEGORY_VIEW_MODE_KEY, DEFAULT_CATEGORY_VIEW_MODE);
  const effectiveCategoryViewMode: CategoryViewMode =
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches ? "list" : categoryViewMode;
  const newCategoryInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCategorySelectRef = useRef<string | null>(null);
  const pendingCategoryRenameIdRef = useRef<string | null>(null);
  const categorySortMenuRef = useRef<HTMLDivElement | null>(null);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const drawerCategoryMenuRef = useRef<HTMLDivElement | null>(null);
  const drawerRenameInputRef = useRef<HTMLInputElement | null>(null);
  const [categorySortMenuOpen, setCategorySortMenuOpen] = useState(false);
  const activeSharedCategoryIds = useQuery(api.sharedFolders.listMyActiveSharedCategoryIds);
  const sharedCategoryIdSet = useMemo(
    () => new Set(activeSharedCategoryIds ?? []),
    [activeSharedCategoryIds],
  );
  const updateShareSnapshot = useMutation(api.sharedFolders.updateShareSnapshot);
  const snapshotDebounceRef = useRef<number | null>(null);

  // Mirrored globally so the "/" shortcut and nav "+" button (route
  // siblings, not children, of this screen) can default a fresh composer
  // draft into whichever category is currently open here.
  useEffect(() => {
    dispatch({ type: "ui/set-active-bookmark-category", categoryId: selectedCategoryId });
    return () => {
      dispatch({ type: "ui/set-active-bookmark-category", categoryId: null });
    };
  }, [dispatch, selectedCategoryId]);

  // Auto-sync shared folder snapshots whenever bookmarks or categories change.
  // Debounced 2 s so rapid edits only trigger one push.
  useEffect(() => {
    if (!activeSharedCategoryIds?.length) return;

    if (snapshotDebounceRef.current !== null) {
      window.clearTimeout(snapshotDebounceRef.current);
    }

    snapshotDebounceRef.current = window.setTimeout(() => {
      snapshotDebounceRef.current = null;
      for (const categoryId of activeSharedCategoryIds) {
        const category = state.bookmarkCategories.find((c) => c.id === categoryId);
        if (!category) continue;
        const bookmarks = state.bookmarks
          .filter((b) => b.categoryId === categoryId)
          .map((b) => ({
            id: b.id,
            url: b.url,
            title: b.title,
            siteName: b.siteName,
            description: b.description,
            thumbnailUrl: b.thumbnailUrl,
            faviconUrl: b.faviconUrl,
          }));
        void updateShareSnapshot({
          categoryId: categoryId as Id<"bookmarkCategories">,
          categoryName: category.name,
          categoryIcon: category.icon,
          bookmarks,
        });
      }
    }, 2000);

    return () => {
      if (snapshotDebounceRef.current !== null) {
        window.clearTimeout(snapshotDebounceRef.current);
      }
    };
  }, [state.bookmarks, state.bookmarkCategories, activeSharedCategoryIds, updateShareSnapshot]);

  useEffect(() => {
    const focusId = (location.state as { focusBookmarkId?: string } | null)?.focusBookmarkId;
    if (!focusId) return;
    window.history.replaceState({}, "");
    const target = state.bookmarks.find((b) => b.id === focusId);
    if (target) {
      setSelectedCategoryId(target.categoryId);
      writeLastSelectedBookmarkCategory(target.categoryId);
    }
    setFocusedBookmarkId(focusId);
    requestAnimationFrame(() => {
      // Via the virtualizer, not a DOM query: off-screen cards aren't mounted
      // once the list is windowed, and a focused bookmark is by definition one
      // the user hasn't scrolled to.
      bookmarksListRefDesktop.current?.scrollToKey(focusId);
      bookmarksListRefMobile.current?.scrollToKey(focusId);
    });
    const timer = window.setTimeout(() => setFocusedBookmarkId(null), 2000);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { dragOffset, isDragging, edgeSwipeProps } = useEdgeSwipeBack(() => setMobileBookmarksOpen(false));
  useHistoryBackClose(mobileBookmarksOpen, () => setMobileBookmarksOpen(false));

  useOutsideClick(categorySortMenuRef, categorySortMenuOpen, () => setCategorySortMenuOpen(false));
  useOutsideClick(categoryMenuRef, Boolean(categoryMenuOpenId), () => setCategoryMenuOpenId(null));
  useOutsideClick(drawerCategoryMenuRef, drawerCategoryMenuOpen, () => setDrawerCategoryMenuOpen(false));

  const activeBookmarks = state.bookmarks;
  const savedCategoryIds = useMemo(
    () => state.bookmarkCategories.filter((category) => isSavedCategoryName(category.name)).map((category) => category.id),
    [state.bookmarkCategories],
  );
  const canonicalSavedCategoryId = savedCategoryIds[0] ?? LINKED_ARTIFACT_SAVED_CATEGORY_ID;
  const savedCategoryIdSet = useMemo(
    () => new Set([...savedCategoryIds, LINKED_ARTIFACT_SAVED_CATEGORY_ID]),
    [savedCategoryIds],
  );
  const gcalCategoryIds = useMemo(
    () => state.bookmarkCategories.filter((category) => isGcalCategoryName(category.name)).map((category) => category.id),
    [state.bookmarkCategories],
  );
  const canonicalGcalCategoryId = gcalCategoryIds[0] ?? LINKED_ARTIFACT_GCAL_CATEGORY_ID;
  const gcalCategoryIdSet = useMemo(
    () => new Set([...gcalCategoryIds, LINKED_ARTIFACT_GCAL_CATEGORY_ID]),
    [gcalCategoryIds],
  );
  const savedBookmarkUrlsForDedupe = useMemo(
    () =>
      activeBookmarks
        .filter((bookmark) => savedCategoryIdSet.has(bookmark.categoryId) || gcalCategoryIdSet.has(bookmark.categoryId))
        .map((bookmark) => bookmark.url),
    [activeBookmarks, savedCategoryIdSet, gcalCategoryIdSet],
  );
  const linkedArtifactBookmarks = useMemo(
    () =>
      buildLinkedArtifactBookmarks({
        notes: state.notes,
        todos: state.todos,
        events: state.events,
        bookmarks: state.bookmarks,
        savedCategoryId: canonicalSavedCategoryId,
        gcalCategoryId: canonicalGcalCategoryId,
        googleImportedTodoIds,
        dedupeUrls: savedBookmarkUrlsForDedupe,
      }),
    [
      canonicalSavedCategoryId,
      canonicalGcalCategoryId,
      googleImportedTodoIds,
      savedBookmarkUrlsForDedupe,
      state.bookmarks,
      state.notes,
      state.events,
      state.todos,
    ],
  );
  const linkedArtifactReferencesByBookmarkId = useMemo(() => {
    const next = new Map<string, LinkedArtifactReference[]>();
    for (const bookmark of linkedArtifactBookmarks) {
      next.set(bookmark.id, bookmark.linkedArtifactReferences);
    }
    return next;
  }, [linkedArtifactBookmarks]);
  const linkedArtifactLookups = useMemo(
    () => ({
      notesById: new Map(state.notes.map((note) => [note.id, note] as const)),
      todosById: new Map(
        state.todos
          .filter((todo) => !todo.deletedAt)
          .map((todo) => [todo.id, todo] as const),
      ),
      eventsById: new Map(
        state.events
          .filter((event) => !event.deletedAt)
          .map((event) => [event.id, event] as const),
      ),
    }),
    [state.notes, state.events, state.todos],
  );
  const activeBookmarksWithLinkedArtifacts = useMemo(
    () => [...activeBookmarks, ...linkedArtifactBookmarks],
    [activeBookmarks, linkedArtifactBookmarks],
  );
  const sourceBookmarks = activeBookmarksWithLinkedArtifacts;
  const categoryNameById = useMemo(() => {
    const map = new Map(state.bookmarkCategories.map((category) => [category.id, category.name] as const));
    map.set(LINKED_ARTIFACT_SAVED_CATEGORY_ID, "Saved");
    map.set(LINKED_ARTIFACT_GCAL_CATEGORY_ID, "Synced from GCal");
    return map;
  }, [state.bookmarkCategories]);
  const managedCategoryIds = useMemo(
    () => new Set(state.bookmarkCategories.map((category) => category.id)),
    [state.bookmarkCategories],
  );

  const allCategoryNames = useMemo(
    () => state.bookmarkCategories.map((category) => category.name),
    [state.bookmarkCategories],
  );

  const duplicateCategoryExists = useMemo(() => {
    const normalized = normalizeCategoryName(newCategoryName);
    if (!normalized) return false;
    return allCategoryNames.some((categoryName) => {
      if (renamingCategoryId) {
        const currentCategory = state.bookmarkCategories.find((c) => c.id === renamingCategoryId);
        if (currentCategory && normalizeCategoryName(currentCategory.name) === normalized) return false;
      }
      return normalizeCategoryName(categoryName) === normalized;
    });
  }, [allCategoryNames, newCategoryName, renamingCategoryId, state.bookmarkCategories]);

  const virtualRowName = (rowId: string) => {
    if (rowId === canonicalSavedCategoryId) return "Saved";
    if (rowId === canonicalGcalCategoryId) return "Synced from GCal";
    return null;
  };

  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const bookmarkSearchQuery = useMemo(() => normalizeSearchQuery(bookmarkSearch), [bookmarkSearch]);

  const categoryRows = useMemo(() => {
    const rows = new Map<string, { id: string; name: string; icon?: string; count: number; matchCount: number; lastUpdated: number; hasMatch: boolean }>();

    for (const category of state.bookmarkCategories) {
      const rowId = isSavedCategoryName(category.name)
        ? canonicalSavedCategoryId
        : isGcalCategoryName(category.name)
          ? canonicalGcalCategoryId
          : category.id;
      const virtualName = virtualRowName(rowId);
      const existing = rows.get(rowId);
      if (existing) {
        existing.lastUpdated = Math.max(existing.lastUpdated, category.createdAt);
        continue;
      }
      rows.set(rowId, {
        id: rowId,
        name: virtualName ?? category.name,
        icon: virtualName ? undefined : category.icon,
        count: 0,
        matchCount: 0,
        lastUpdated: category.createdAt,
        hasMatch: false,
      });
    }

    for (const bookmark of sourceBookmarks) {
      const rowId = savedCategoryIdSet.has(bookmark.categoryId)
        ? canonicalSavedCategoryId
        : gcalCategoryIdSet.has(bookmark.categoryId)
          ? canonicalGcalCategoryId
          : bookmark.categoryId;
      const virtualName = virtualRowName(rowId);
      const matches = bookmarkSearchQuery
        ? matchesQuery(bookmarkSearchQuery, bookmark.title, bookmark.url, bookmark.siteName, bookmark.description)
        : false;
      const existing = rows.get(rowId);
      if (existing) {
        existing.count += 1;
        existing.lastUpdated = Math.max(existing.lastUpdated, bookmark.createdAt);
        if (matches) {
          existing.hasMatch = true;
          existing.matchCount += 1;
        }
      } else {
        rows.set(rowId, {
          id: rowId,
          name: virtualName ?? "Uncategorized",
          icon: undefined,
          count: 1,
          matchCount: matches ? 1 : 0,
          lastUpdated: bookmark.createdAt,
          hasMatch: matches,
        });
      }
    }

    return [...rows.values()].sort((left, right) => {
      let comparison = 0;
      if (categorySort.key === "alphabetical") {
        comparison = left.name.localeCompare(right.name);
      } else if (categorySort.key === "lastUpdated") {
        comparison = left.lastUpdated - right.lastUpdated;
      } else {
        comparison = left.count - right.count;
      }

      if (comparison === 0) {
        comparison = left.name.localeCompare(right.name);
      }

      return categorySort.direction === "asc" ? comparison : -comparison;
    });
  }, [
    canonicalSavedCategoryId,
    canonicalGcalCategoryId,
    categorySort.direction,
    categorySort.key,
    savedCategoryIdSet,
    gcalCategoryIdSet,
    sourceBookmarks,
    state.bookmarkCategories,
    bookmarkSearchQuery,
  ]);

  const visibleCategoryRows = bookmarkSearchQuery ? categoryRows.filter((row) => row.hasMatch) : categoryRows;

  const selectedCategory = selectedCategoryId ? visibleCategoryRows.find((category) => category.id === selectedCategoryId) ?? null : null;

  useEffect(() => {
    if (!visibleCategoryRows.length) {
      if (selectedCategoryId !== null) {
        setSelectedCategoryId(null);
      }
      return;
    }

    // Suppress reset while a rename mutation is in-flight — the category ID is
    // stable across a rename, but guard against any transient reactive update.
    if (pendingCategoryRenameIdRef.current !== null) {
      const pendingId = pendingCategoryRenameIdRef.current;
      if (visibleCategoryRows.some((c) => c.id === pendingId)) {
        pendingCategoryRenameIdRef.current = null;
      } else {
        return;
      }
    }

    const selectedExists = selectedCategoryId === null || visibleCategoryRows.some((category) => category.id === selectedCategoryId);

    if (!selectedExists) {
      setSelectedCategoryId(visibleCategoryRows.find((category) => category.count > 0)?.id ?? visibleCategoryRows[0]?.id ?? null);
    }
  }, [selectedCategoryId, visibleCategoryRows]);

  useEffect(() => {
    if (!creatingCategory && !renamingCategoryId) return;
    if (drawerRenaming) {
      drawerRenameInputRef.current?.focus();
      return;
    }
    newCategoryInputRef.current?.focus();
  }, [creatingCategory, renamingCategoryId, drawerRenaming]);

  useEffect(() => {
    if (!selectedCategoryId) return;
    writeLastSelectedBookmarkCategory(selectedCategoryId);
  }, [selectedCategoryId]);

  useEffect(() => {
    const pendingName = pendingCategorySelectRef.current;
    if (!pendingName) return;
    const match = state.bookmarkCategories.find((category) => normalizeCategoryName(category.name) === normalizeCategoryName(pendingName));
    if (!match) return;
    setSelectedCategoryId(match.id);
    pendingCategorySelectRef.current = null;
  }, [state.bookmarkCategories]);

  const visibleBookmarks = useMemo(() => {
    const items =
      selectedCategoryId === null
        ? sourceBookmarks
        : sourceBookmarks.filter((bookmark) => {
            const rowId = savedCategoryIdSet.has(bookmark.categoryId)
              ? canonicalSavedCategoryId
              : gcalCategoryIdSet.has(bookmark.categoryId)
                ? canonicalGcalCategoryId
                : bookmark.categoryId;
            return rowId === selectedCategoryId;
          });

    return [...items].sort((left, right) =>
      bookmarkSortDirection === "asc" ? left.createdAt - right.createdAt : right.createdAt - left.createdAt,
    );
  }, [
    bookmarkSortDirection,
    canonicalSavedCategoryId,
    canonicalGcalCategoryId,
    savedCategoryIdSet,
    gcalCategoryIdSet,
    selectedCategoryId,
    sourceBookmarks,
  ]);

  const editingBookmark =
    state.bookmarks.find((bookmark) => bookmark.id === editingBookmarkId) ??
    state.deletedBookmarks.find((bookmark) => bookmark.id === editingBookmarkId) ??
    null;
  const noteCategoryIdForCreate =
    selectedCategoryId && managedCategoryIds.has(selectedCategoryId)
      ? selectedCategoryId
      : state.bookmarkCategories.find((category) => isSavedCategoryName(category.name))?.id ??
        state.bookmarkCategories[0]?.id ??
        null;
  const visibleCount = visibleBookmarks.length;
  const selectedCategoryLabel = selectedCategory?.name ?? "Bookmarks";
  const bookmarkSortLabel = bookmarkSortDirection === "asc" ? "Oldest" : "Latest";
  const openCategoryBookmarks = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileBookmarksOpen(true);
    }
  };
  const openLinkedArtifactReference = (reference: LinkedArtifactReference) => {
    if (reference.kind === "note") {
      navigate("/notes", { state: { focusNoteId: reference.artifactId } });
    } else if (reference.kind === "todo") {
      navigate("/todos", { state: { focusTodoId: reference.artifactId } });
    } else {
      navigate("/event");
    }
  };

  const commitCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCreatingCategory(false);
      setRenamingCategoryId(null);
      setNewCategoryName("");
      setNewCategoryError(null);
      setEditingIcon(undefined);
      setIconPickerOpen(false);
      return;
    }
    if (duplicateCategoryExists) {
      setNewCategoryError("Category name already exists");
      return;
    }
    if (renamingCategoryId) {
      dispatch({ type: "bookmark-category/update", categoryId: renamingCategoryId, name, icon: editingIcon });
      pendingCategoryRenameIdRef.current = renamingCategoryId;
    } else {
      dispatch({ type: "bookmark-category/create", name, icon: editingIcon });
      pendingCategorySelectRef.current = name;
    }
    setCreatingCategory(false);
    setRenamingCategoryId(null);
    setCategoryMenuOpenId(null);
    setNewCategoryName("");
    setNewCategoryError(null);
    setEditingIcon(undefined);
    setIconPickerOpen(false);
    setDrawerRenaming(false);
  };

  const cancelCategory = () => {
    setCreatingCategory(false);
    setRenamingCategoryId(null);
    setNewCategoryName("");
    setNewCategoryError(null);
    setEditingIcon(undefined);
    setIconPickerOpen(false);
    setDrawerRenaming(false);
  };

  const commitCategoryOnBlur = () => {
    if (duplicateCategoryExists) { cancelCategory(); return; }
    commitCategory();
  };

  const toggleCategorySort = (nextKey: CategorySortKey) => {
    setCategorySort((current) =>
      current.key === nextKey
        ? { key: nextKey, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key: nextKey, direction: "desc" },
    );
    setCategorySortMenuOpen(false);
  };

  useTopChrome(<ExpandableSearch value={bookmarkSearch} onChange={setBookmarkSearch} placeholder="Search in Bookmarks" />);

  const renderBookmarksPanel = (isMobileDrawer = false) => (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex flex-col pt-[env(safe-area-inset-top)] lg:hidden">
        {/* Slim invisible hotzone: swiping right from here (not the whole
            panel) dismisses it, so the rest of the panel keeps native
            vertical scrolling. */}
        <div aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-6" {...edgeSwipeProps} />
        {isMobileDrawer && drawerRenaming ? (
          <div className="relative mb-3 flex items-center gap-2 border-b border-app-line px-4 pb-3 pt-3">
            <button
              type="button"
              aria-label="Back to folders"
              onClick={() => setMobileBookmarksOpen(false)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
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
              value={newCategoryName}
              onChange={(e) => { setNewCategoryName(e.target.value); setNewCategoryError(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitCategory(); }
                else if (e.key === "Escape") { e.preventDefault(); cancelCategory(); }
              }}
              onBlur={iconPickerOpen ? undefined : commitCategoryOnBlur}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold text-app-ink outline-none placeholder:text-app-ink-faint"
            />
            {newCategoryError ? (
              <div className="absolute left-14 top-full z-app-tooltip mt-2 rounded-md border border-danger-line bg-app-surface px-2 py-1 text-xs text-danger-ink shadow-soft">
                {newCategoryError}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-2 border-b border-app-line px-4 pb-3 pt-3">
            <button
              type="button"
              aria-label="Back to folders"
              onClick={() => setMobileBookmarksOpen(false)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              {selectedCategory && managedCategoryIds.has(selectedCategory.id) ? (
                <button
                  ref={drawerDirectIconButtonRef}
                  type="button"
                  aria-label="Change icon"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDirectIconCategoryId(selectedCategory.id);
                    setEditingIcon(selectedCategory.icon);
                    iconPickerAnchorRef.current = drawerDirectIconButtonRef.current;
                    setIconPickerOpen(true);
                  }}
                  className="flex-shrink-0 rounded-md p-0.5 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <CategoryIconView icon={selectedCategory.icon} size="sm" />
                </button>
              ) : (
                <span className="flex-shrink-0 text-app-ink-faint">
                  <CategoryIconView icon={selectedCategory?.icon} size="sm" />
                </span>
              )}
              <p className="min-w-0 truncate text-sm font-bold text-app-ink">{selectedCategoryLabel}</p>
              {selectedCategory && sharedCategoryIdSet.has(selectedCategory.id) && (
                <Globe className="h-3.5 w-3.5 flex-shrink-0 text-app-ink-faint" aria-label="Public" />
              )}
            </span>
            {isMobileDrawer && selectedCategoryId && managedCategoryIds.has(selectedCategoryId) && selectedCategory ? (
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Share category"
                  onClick={() => setShareFolderModal({ categoryId: selectedCategory.id, categoryName: selectedCategory.name, categoryIcon: selectedCategory.icon })}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <div className="relative" ref={drawerCategoryMenuOpen ? drawerCategoryMenuRef : undefined}>
                  <button
                    type="button"
                    aria-label="Category actions"
                    aria-expanded={drawerCategoryMenuOpen}
                    onClick={() => setDrawerCategoryMenuOpen((c) => !c)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {drawerCategoryMenuOpen ? (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-app-menu mt-1 w-44 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setRenamingCategoryId(selectedCategory.id);
                          setNewCategoryName(selectedCategory.name);
                          setEditingIcon(selectedCategory.icon);
                          setNewCategoryError(null);
                          setDrawerCategoryMenuOpen(false);
                          setDrawerRenaming(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                      >
                        <Pencil className="h-4 w-4" />
                        Rename
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setDeleteTarget({ id: selectedCategory.id, name: selectedCategory.name, count: selectedCategory.count });
                          setDrawerCategoryMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger-ink transition hover:bg-danger-surface"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div className={cn("mb-3 flex items-center gap-3 lg:px-0", isMobileDrawer ? "justify-end px-4" : "justify-between")}>
        {!isMobileDrawer ? (
          <button
            type="button"
            aria-label="Add bookmark"
            onClick={() => handleCreateBookmark()}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-app-line bg-app-surface text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Sort bookmarks"
          onClick={() => setBookmarkSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
          className="flex h-8 items-center gap-1 rounded-md border border-app-line bg-app-surface px-2 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
        >
          <span className="text-xs font-medium">{bookmarkSortLabel}</span>
          {bookmarkSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {visibleCount ? (
        <VirtualList
          ref={isMobileDrawer ? bookmarksListRefMobile : bookmarksListRefDesktop}
          items={visibleBookmarks}
          getKey={bookmarkRowKey}
          // Mirrors the grid this used to be:
          // `repeat(auto-fit,minmax(240px,1fr))` with `gap-4`.
          minColumnWidth={240}
          gap={16}
          estimateSize={220}
          className={cn("scrollbar-hide min-h-0 flex-1 pb-24 lg:px-0", isMobileDrawer && "px-4")}
          renderItem={(bookmark) => {
            const isLinkedArtifactBookmark = isLinkedArtifactBookmarkId(bookmark.id);
            return (
              <div
                data-bookmark-row-id={bookmark.id}
                // Kept for the unwindowed path, where every card is still in
                // the DOM and skipping off-screen paint work is still worth it.
                style={{ contentVisibility: "auto", containIntrinsicSize: "0 220px" }}
                className={focusedBookmarkId === bookmark.id ? "ring-2 ring-app-accent rounded-2xl transition-shadow duration-700" : undefined}
              >
                <BookmarkCard
                  bookmark={bookmark}
                  categoryName={bookmarkCategoryName(bookmark, categoryNameById)}
                  linkedArtifactReferences={linkedArtifactReferencesByBookmarkId.get(bookmark.id) ?? []}
                  linkedArtifactLookups={linkedArtifactLookups}
                  onOpenLinkedArtifactReference={openLinkedArtifactReference}
                  surface="default"
                  onEdit={!isLinkedArtifactBookmark ? (nextBookmark) => {
                    setEditingBookmarkId(nextBookmark.id);
                    setMobileBookmarksOpen(false);
                  } : undefined}
                  onDelete={!isLinkedArtifactBookmark ? (bookmarkId) => dispatch({ type: "bookmark/delete", bookmarkId }) : undefined}
                  highlightQuery={bookmarkSearchQuery}
                />
              </div>
            );
          }}
        />
      ) : (
        <EmptyState
          className="h-full"
          title={selectedCategoryId === null ? "No bookmarks yet" : `No bookmarks in ${selectedCategoryLabel}`}
          description={
            selectedCategoryId === null
              ? "Save a link from the + composer or create a bookmark here."
              : "Create a bookmark or move an existing one into this category."
          }
          actionLabel="Create bookmark"
          onAction={() => handleCreateBookmark()}
        />
      )}
      {isMobileDrawer ? (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2">
          <button
            type="button"
            aria-label="Add bookmark"
            onClick={() => handleCreateBookmark()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-app-line bg-app-surface p-0 text-app-ink-muted shadow-soft transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className="fixed left-0 right-0 z-0 flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{
        top: "var(--omanote-top-chrome-height, 0px)",
        bottom: "0px",
      }}
    >
      <div className="relative grid h-full min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[227px_minmax(0,1fr)]">
        <aside className="h-full min-h-0 overflow-hidden pt-4">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 flex items-center justify-between gap-3">
              <button
                type="button"
                aria-label="Add category"
                onClick={() => {
                  setCreatingCategory(true);
                  setNewCategoryName("");
                  setNewCategoryError(null);
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
                    onClick={() => setCategoryViewMode("list")}
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-l-md transition",
                      categoryViewMode === "list"
                        ? "bg-app-surface-muted text-app-ink"
                        : "text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink-muted",
                    ].join(" ")}
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Gallery view"
                    onClick={() => setCategoryViewMode("gallery")}
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-r-md transition",
                      categoryViewMode === "gallery"
                        ? "bg-app-surface-muted text-app-ink"
                        : "text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink-muted",
                    ].join(" ")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
                <div ref={categorySortMenuRef} className="relative">
                  <button
                    type="button"
                    aria-label="Sort categories"
                    onClick={() => setCategorySortMenuOpen((open) => !open)}
                    className="flex h-8 items-center gap-1 rounded-md border border-app-line bg-app-surface px-2 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{sortLabel(categorySort.key)}</span>
                    {categorySort.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                  </button>
                  {categorySortMenuOpen ? (
                    <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft">
                      {(["alphabetical", "lastUpdated", "totalBookmarks"] as CategorySortKey[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleCategorySort(option)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                        >
                          <span>{sortLabel(option)}</span>
                          {categorySort.key === option ? (
                            categorySort.direction === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-16">
              {effectiveCategoryViewMode === "gallery" ? (
                <div className="grid grid-cols-3 gap-2">
                  {creatingCategory ? (
                    <div className="col-span-3">
                      <CategoryRow
                        categoryName=""
                        icon={editingIcon}
                        count={0}
                        selected={false}
                        onClick={() => undefined}
                        isEditing
                        inputValue={newCategoryName}
                        onInputChange={(value) => {
                          setNewCategoryName(value);
                          setNewCategoryError(null);
                        }}
                        onInputKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitCategory();
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            cancelCategory();
                          }
                        }}
                        inputRef={newCategoryInputRef}
                        duplicateError={newCategoryError}
                        onCancel={iconPickerOpen ? undefined : commitCategoryOnBlur}
                        onIconClick={(ref) => { iconPickerAnchorRef.current = ref.current; setIconPickerOpen(true); }}
                      />
                    </div>
                  ) : null}

                  {visibleCategoryRows.map((category) =>
                    renamingCategoryId === category.id && !drawerRenaming ? (
                      <div key={category.id} className="col-span-3">
                        <CategoryRow
                          categoryName={category.name}
                          icon={editingIcon}
                          count={category.count}
                          selected={false}
                          onClick={() => undefined}
                          isEditing
                          inputValue={newCategoryName}
                          onInputChange={(value) => {
                            setNewCategoryName(value);
                            setNewCategoryError(null);
                          }}
                          onInputKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitCategory();
                            } else if (event.key === "Escape") {
                              event.preventDefault();
                              cancelCategory();
                            }
                          }}
                          inputRef={newCategoryInputRef}
                          duplicateError={newCategoryError}
                          onCancel={iconPickerOpen ? undefined : commitCategoryOnBlur}
                          placeholder={category.name}
                          onIconClick={(ref) => { iconPickerAnchorRef.current = ref.current; setIconPickerOpen(true); }}
                        />
                      </div>
                    ) : (
                      <CategoryCard
                        key={category.id}
                        categoryName={category.name}
                        icon={category.icon}
                        count={bookmarkSearchQuery ? category.matchCount : category.count}
                        selected={selectedCategoryId === category.id}
                        onClick={() => openCategoryBookmarks(category.id)}
                        isShared={sharedCategoryIdSet.has(category.id)}
                        onIconClick={managedCategoryIds.has(category.id) && isDesktop ? (ref) => {
                          setDirectIconCategoryId(category.id);
                          setEditingIcon(category.icon);
                          iconPickerAnchorRef.current = ref.current;
                          setIconPickerOpen(true);
                        } : () => openCategoryBookmarks(category.id)}
                        iconPickerActive={directIconCategoryId === category.id}
                        actions={
                          isDesktop && managedCategoryIds.has(category.id) ? (
                            <div className="hidden lg:flex">
                              <CategoryActionMenu
                                categoryId={category.id}
                                categoryName={category.name}
                                isOpen={categoryMenuOpenId === category.id}
                                menuRef={categoryMenuOpenId === category.id ? categoryMenuRef : undefined}
                                size="sm"
                                isShared={sharedCategoryIdSet.has(category.id)}
                                onToggle={() => setCategoryMenuOpenId((c) => (c === category.id ? null : category.id))}
                                onRename={() => {
                                  setRenamingCategoryId(category.id);
                                  setNewCategoryName(category.name);
                                  setEditingIcon(category.icon);
                                  setNewCategoryError(null);
                                  setCategoryMenuOpenId(null);
                                }}
                                onShare={() => {
                                  setShareFolderModal({ categoryId: category.id, categoryName: category.name, categoryIcon: category.icon });
                                  setCategoryMenuOpenId(null);
                                }}
                                onDelete={() => {
                                  setDeleteTarget({ id: category.id, name: category.name, count: category.count });
                                  setCategoryMenuOpenId(null);
                                }}
                              />
                            </div>
                          ) : null
                        }
                      />
                    )
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {creatingCategory ? (
                    <CategoryRow
                      categoryName=""
                      icon={editingIcon}
                      count={0}
                      selected={false}
                      onClick={() => undefined}
                      isEditing
                      inputValue={newCategoryName}
                      onInputChange={(value) => {
                        setNewCategoryName(value);
                        setNewCategoryError(null);
                      }}
                      onInputKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitCategory();
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          cancelCategory();
                        }
                      }}
                      inputRef={newCategoryInputRef}
                      duplicateError={newCategoryError}
                      onCancel={iconPickerOpen ? undefined : commitCategoryOnBlur}
                      onIconClick={(ref) => { iconPickerAnchorRef.current = ref.current; setIconPickerOpen(true); }}
                    />
                  ) : null}

                  {visibleCategoryRows.map((category) =>
                    renamingCategoryId === category.id && !drawerRenaming ? (
                      <CategoryRow
                        key={category.id}
                        categoryName={category.name}
                        icon={editingIcon}
                        count={category.count}
                        selected={false}
                        onClick={() => undefined}
                        isEditing
                        inputValue={newCategoryName}
                        onInputChange={(value) => {
                          setNewCategoryName(value);
                          setNewCategoryError(null);
                        }}
                        onInputKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitCategory();
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            cancelCategory();
                          }
                        }}
                        inputRef={newCategoryInputRef}
                        duplicateError={newCategoryError}
                        onCancel={iconPickerOpen ? undefined : commitCategoryOnBlur}
                        placeholder={category.name}
                        onIconClick={(ref) => { iconPickerAnchorRef.current = ref.current; setIconPickerOpen(true); }}
                      />
                    ) : (
                      <CategoryRow
                        key={category.id}
                        categoryName={category.name}
                        icon={category.icon}
                        count={bookmarkSearchQuery ? category.matchCount : category.count}
                        selected={selectedCategoryId === category.id}
                        onClick={() => openCategoryBookmarks(category.id)}
                        isShared={sharedCategoryIdSet.has(category.id)}
                        onIconClick={managedCategoryIds.has(category.id) && isDesktop ? (ref) => {
                          setDirectIconCategoryId(category.id);
                          setEditingIcon(category.icon);
                          iconPickerAnchorRef.current = ref.current;
                          setIconPickerOpen(true);
                        } : () => openCategoryBookmarks(category.id)}
                        iconPickerActive={directIconCategoryId === category.id}
                        actions={
                          isDesktop && managedCategoryIds.has(category.id) ? (
                            <div className="hidden lg:flex">
                              <CategoryActionMenu
                                categoryId={category.id}
                                categoryName={category.name}
                                isOpen={categoryMenuOpenId === category.id}
                                menuRef={categoryMenuOpenId === category.id ? categoryMenuRef : undefined}
                                size="md"
                                isShared={sharedCategoryIdSet.has(category.id)}
                                onToggle={() => setCategoryMenuOpenId((c) => (c === category.id ? null : category.id))}
                                onRename={() => {
                                  setRenamingCategoryId(category.id);
                                  setNewCategoryName(category.name);
                                  setEditingIcon(category.icon);
                                  setNewCategoryError(null);
                                  setCategoryMenuOpenId(null);
                                }}
                                onShare={() => {
                                  setShareFolderModal({ categoryId: category.id, categoryName: category.name, categoryIcon: category.icon });
                                  setCategoryMenuOpenId(null);
                                }}
                                onDelete={() => {
                                  setDeleteTarget({ id: category.id, name: category.name, count: category.count });
                                  setCategoryMenuOpenId(null);
                                }}
                              />
                            </div>
                          ) : null
                        }
                      />
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="hidden min-h-0 flex-1 flex-col lg:flex lg:border-l lg:border-app-line lg:pl-4 lg:pt-4">
          {renderBookmarksPanel(false)}
        </section>
      </div>

      <ModalPortal>
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-app-overlay bg-app-canvas/55 transform-gpu transition-opacity duration-app-drawer ease-app-drawer lg:hidden",
            mobileBookmarksOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileBookmarksOpen(false)}
        />
        <section
          className={cn(
            "fixed inset-0 z-app-drawer flex min-h-0 flex-col bg-app-surface shadow-app-drawer transform-gpu lg:hidden",
            isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
            mobileBookmarksOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
          )}
          style={isDragging || dragOffset > 0 ? { transform: `translateX(${dragOffset}px)` } : undefined}
        >
          {renderBookmarksPanel(true)}
        </section>
      </ModalPortal>

      {creating ? (
        <BookmarkEditorModal
          categories={state.bookmarkCategories}
          selectedCategoryId={noteCategoryIdForCreate}
          onClose={() => setCreating(false)}
          onSave={(payload) => {
            dispatch({
              type: "bookmark/create",
              url: payload.url,
              categoryId: payload.categoryId,
              categoryName: payload.categoryName,
              draftKey: payload.draftKey,
              dateKey: state.ui.selectedDateKey,
            });
            setCreating(false);
          }}
        />
      ) : null}

      {editingBookmark ? (
        <BookmarkEditorModal
          bookmark={editingBookmark as BookmarkItem}
          categories={state.bookmarkCategories}
          selectedCategoryId={editingBookmark.categoryId}
          onClose={() => setEditingBookmarkId(null)}
          onSave={(payload) => {
            dispatch({
              type: "bookmark/update",
              bookmarkId: editingBookmark.id,
              categoryId: payload.categoryId,
              categoryName: payload.categoryName,
              url: payload.url,
              draftKey: payload.draftKey,
            });
            setEditingBookmarkId(null);
          }}
          onDelete={() => {
            dispatch({ type: "bookmark/delete", bookmarkId: editingBookmark.id });
            setEditingBookmarkId(null);
          }}
        />
      ) : null}

      {shareFolderModal ? (
        <ShareFolderModal
          categoryId={shareFolderModal.categoryId}
          categoryName={shareFolderModal.categoryName}
          categoryIcon={shareFolderModal.categoryIcon}
          onClose={() => setShareFolderModal(null)}
        />
      ) : null}

      {deleteTarget ? (
        <BaseModal onClose={() => setDeleteTarget(null)} zIndex="z-app-dialog">
          <div className="w-full max-w-md rounded-xl border border-app-line bg-app-surface p-5 shadow-soft">
            <h2 className="text-lg font-bold text-app-ink">{`Delete "${deleteTarget.name}"?`}</h2>
            <p className="mt-2 text-sm leading-6 text-app-ink-muted">
              {deleteTarget.count > 0
                ? `This category contains ${deleteTarget.count} bookmarks. You can delete the category and keep the bookmarks by moving them to Saved, or delete the category and all bookmarks inside it.`
                : "This category is empty. Deleting it will remove the category."}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="plain" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                {deleteTarget.count > 0 ? (
                  <Button
                    variant="dangerGhost"
                    onClick={() => {
                      dispatch({ type: "bookmark-category/delete-with-bookmarks", categoryId: deleteTarget.id });
                      setDeleteTarget(null);
                    }}
                  >
                    Delete category and bookmarks
                  </Button>
                ) : null}
                <Button
                  variant="default"
                  onClick={() => {
                    dispatch({ type: "bookmark-category/delete", categoryId: deleteTarget.id });
                    setDeleteTarget(null);
                  }}
                >
                  {deleteTarget.count > 0 ? "Delete category only" : "Delete category"}
                </Button>
              </div>
            </div>
          </div>
        </BaseModal>
      ) : null}

      {iconPickerOpen ? (
        <BookmarkCategoryIconPicker
          key={directIconCategoryId ?? renamingCategoryId ?? "new"}
          anchorRef={iconPickerAnchorRef}
          currentIcon={editingIcon}
          onSelect={(icon) => {
            if (directIconCategoryId) {
              const category = state.bookmarkCategories.find((c) => c.id === directIconCategoryId);
              if (category) dispatch({ type: "bookmark-category/update", categoryId: directIconCategoryId, name: category.name, icon });
              setDirectIconCategoryId(null);
              setEditingIcon(undefined);
            } else {
              setEditingIcon(icon);
            }
            setIconPickerOpen(false);
          }}
          onClose={() => {
            setIconPickerOpen(false);
            if (directIconCategoryId) {
              setDirectIconCategoryId(null);
              setEditingIcon(undefined);
            }
          }}
        />
      ) : null}
    </div>
  );
}
