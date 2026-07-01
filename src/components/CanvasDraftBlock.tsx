import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, CalendarDays, CheckSquare, Clock3, FileText, X } from "lucide-react";
import { useApp } from "../app/AppProvider";
import { parseEventDraftInput, parseTodoDraftInput, randomId } from "@omanote/shared";
import { handlePasteAsLink } from "../lib/link-utils";
import { useOutsideClick } from "../lib/useOutsideClick";
import { SegmentedHighlight, SegmentedItem, SegmentedShell, TodoCheckmark } from "./ui";
import { hasMeaningfulNoteInput, isUncategorizedFolderName, readLastNoteFolder, resolveNoteFolderByName, writeLastNoteFolder } from "../lib/note-folder-utils";
import { MobileSaveButton } from "./MobileSaveButton";
import { hashtagColor, hashtagHighlightSegments, parseHashtags } from "../lib/hashtags";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { isNewlineShortcutEvent, isSaveShortcutEvent } from "../lib/editor-shortcuts";
import { useMeasuredHighlight } from "../hooks/useMeasuredHighlight";
import { NoteCanvasEditor } from "./NoteCanvasEditor";
import { useMobileKeyboardState } from "./layout/useMobileKeyboardState";
import { HashtagPickerDropdown, useHashtagPicker } from "./HashtagPicker";

type DraftMode = "note" | "todo" | "bookmark" | "event";

const commands: Array<{ key: DraftMode; label: string }> = [
  { key: "todo", label: "todo" },
  { key: "event", label: "event" },
  { key: "bookmark", label: "bookmark" },
];

const draftModeOptions = [
  { key: "note" as const, label: "note", Icon: FileText },
  { key: "todo" as const, label: "todo", Icon: CheckSquare },
  { key: "event" as const, label: "event", Icon: CalendarDays },
  { key: "bookmark" as const, label: "bookmark", Icon: Bookmark },
];

const modeMeta: Record<DraftMode, { label: string; chipClass: string; textClass: string }> = {
  note: {
    label: "note",
    chipClass: "bg-app-surface-muted text-app-ink-muted",
    textClass: "text-app-ink",
  },
  todo: {
    label: "todo",
    chipClass: "bg-info-surface text-info-ink",
    textClass: "text-app-ink",
  },
  bookmark: {
    label: "bookmark",
    chipClass: "bg-success-surface text-success-ink",
    textClass: "text-app-ink",
  },
  event: {
    label: "event",
    chipClass: "bg-danger-surface text-danger-ink",
    textClass: "text-app-ink",
  },
};

function stripSlashPrefix(value: string) {
  return value.replace(/^\/\s*/, "");
}

function parseSlashCommand(value: string) {
  const firstLine = value.split(/\r?\n/, 1)[0] ?? "";
  if (!firstLine.startsWith("/")) return null;
  const filter = stripSlashPrefix(firstLine).trim().toLowerCase();
  return { firstLine, filter };
}

type TodoDraftLine = {
  id: string;
  text: string;
};

type BookmarkCategoryMenuItem =
  | {
      kind: "existing";
      key: string;
      label: string;
      value: string;
    }
  | {
      kind: "create";
      key: string;
      label: string;
      value: string;
    };

function createTodoDraftLine(text = ""): TodoDraftLine {
  return {
    id: randomId(),
    text,
  };
}

function textToDraftLines(text: string) {
  const lines = text.split(/\r?\n/);
  return (lines.length ? lines : [""]).map((line) => createTodoDraftLine(line));
}

function draftLinesToText(lines: TodoDraftLine[]) {
  return lines.map((line) => line.text).join("\n");
}

function MobileArtifactTypeSwitcher({
  activeMode,
  onModeChange,
}: {
  activeMode: DraftMode;
  onModeChange: (nextMode: DraftMode) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({
    note: null,
    todo: null,
    event: null,
    bookmark: null,
  });
  const highlightStyle = useMeasuredHighlight({
    activeKey: activeMode,
    containerRef,
    itemRefs,
    layoutKey: activeMode,
    observeResize: false,
  });

  return (
    <SegmentedShell ref={containerRef} aria-label="Artifact type" className="absolute bottom-full left-0 z-20 mb-3 h-9 rounded-full p-1 shadow-app-nav md:hidden">
      {highlightStyle ? <SegmentedHighlight style={highlightStyle} className="rounded-full" /> : null}
      {draftModeOptions.map(({ key, label, Icon }) => (
        <SegmentedItem
          key={key}
          ref={(node) => {
            itemRefs.current[key] = node;
          }}
          aria-label={`Switch artifact type to ${label}`}
          aria-pressed={activeMode === key}
          active={activeMode === key}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onModeChange(key)}
          className="relative z-10 flex h-7 w-8 items-center justify-center px-0 text-app-ink-faint transition-colors duration-150"
        >
          <Icon className="h-3.5 w-3.5" />
        </SegmentedItem>
      ))}
    </SegmentedShell>
  );
}

const BOOKMARK_LAST_CATEGORY_KEY = "omanote.bookmark-last-category";

function readLastBookmarkCategory() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(BOOKMARK_LAST_CATEGORY_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeLastBookmarkCategory(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BOOKMARK_LAST_CATEGORY_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

export function CanvasDraftBlock() {
  const { state, dispatch } = useApp();
  const { settings } = useUserSettings();
  const [mode, setMode] = useState<DraftMode>("note");
  const [body, setBody] = useState("");
  const [noteFolderValue, setNoteFolderValue] = useState(() => readLastNoteFolder());
  const [commandValue, setCommandValue] = useState("");
  const [commandFilter, setCommandFilter] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [noteFocused, setNoteFocused] = useState(false);
  const allowTodoBlurRef = useRef(false);
  const allowBookmarkBlurRef = useRef(false);
  const allowEventBlurRef = useRef(false);
  const [todoLines, setTodoLines] = useState<TodoDraftLine[]>(() => [createTodoDraftLine()]);
  const [activeTodoLineId, setActiveTodoLineId] = useState<string>(todoLines[0]?.id ?? "");
  const [todoFolderValue, setTodoFolderValue] = useState("Others");
  const [todoFolderOpen, setTodoFolderOpen] = useState(false);
  const [todoFolderActiveIndex, setTodoFolderActiveIndex] = useState(0);
  const todoFolderContainerRef = useRef<HTMLDivElement | null>(null);
  const todoFolderInputRef = useRef<HTMLInputElement | null>(null);
  const todoFocusPendingRef = useRef(false);
  const [bookmarkUrl, setBookmarkUrl] = useState("");
  const [bookmarkCategoryValue, setBookmarkCategoryValue] = useState(() => readLastBookmarkCategory());
  const [bookmarkCategoryOpen, setBookmarkCategoryOpen] = useState(false);
  const [bookmarkCategoryActiveIndex, setBookmarkCategoryActiveIndex] = useState(0);
  const bookmarkFocusPendingRef = useRef(false);
  const bookmarkUrlInputRef = useRef<HTMLInputElement | null>(null);
  const bookmarkCategoryInputRef = useRef<HTMLInputElement | null>(null);
  const [eventLines, setEventLines] = useState<TodoDraftLine[]>(() => [createTodoDraftLine()]);
  const [activeEventLineId, setActiveEventLineId] = useState<string>(eventLines[0]?.id ?? "");
  const eventFocusPendingRef = useRef(false);
  const eventStartedAtRef = useRef<number>(Date.now());
  const noteEditorHostRef = useRef<HTMLDivElement | null>(null);
  const todoLineRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const activeTodoInputRef = useRef<HTMLInputElement | null>(null);
  const eventLineRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const activeEventInputRef = useRef<HTMLInputElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [mobileSwitcherVisible, setMobileSwitcherVisible] = useState(false);
  const suppressSwitcherRef = useRef(false);
  const bookmarkCategoryContainerRef = useRef<HTMLDivElement | null>(null);
  const [categoryMenuPos, setCategoryMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const ensureEditorVisibleFrameRef = useRef<number | null>(null);
  const [pickerPlacement, setPickerPlacement] = useState<"above" | "below">("below");
  const mobileKeyboard = useMobileKeyboardState();

  const ensureEditorVisible = useCallback(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    const active = document.activeElement as HTMLElement | null;
    if (!active || !shellRef.current?.contains(active)) return;
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
    const rect = active.getBoundingClientRect();
    const withinViewportBounds = rect.top >= viewportTop + 12 && rect.bottom <= viewportBottom - 12;
    if (withinViewportBounds) return;
    active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  }, []);

  // Scroll just enough so the bottom of the draft block clears the fixed bottom
  // navbar. Called after the textarea auto-resizes so new lines don't disappear
  // behind the nav bar.
  const scrollDraftBottomIntoView = useCallback(() => {
    if (typeof window === "undefined" || !shellRef.current) return;
    const navHeightRaw = getComputedStyle(document.documentElement).getPropertyValue("--omanote-bottom-nav-height");
    const navHeight = Number.parseFloat(navHeightRaw) || 80;
    const rect = shellRef.current.getBoundingClientRect();
    const visibleBottom = window.innerHeight - navHeight - 28;
    if (rect.bottom > visibleBottom) {
      window.scrollBy({ top: rect.bottom - visibleBottom, behavior: "auto" });
    }
  }, []);

  const queueEnsureEditorVisible = useCallback(() => {
    if (ensureEditorVisibleFrameRef.current !== null) return;
    ensureEditorVisibleFrameRef.current = window.requestAnimationFrame(() => {
      ensureEditorVisibleFrameRef.current = null;
      ensureEditorVisible();
    });
  }, [ensureEditorVisible]);

  const hideMobileSwitcherIfFocusLeavesDraft = useCallback(() => {
    window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        if (shellRef.current?.contains(active)) return;
      }
      setMobileSwitcherVisible(false);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (ensureEditorVisibleFrameRef.current === null) return;
      window.cancelAnimationFrame(ensureEditorVisibleFrameRef.current);
      ensureEditorVisibleFrameRef.current = null;
    };
  }, []);

  const visibleCommands = useMemo(() => {
    const nextFilter = commandFilter.trim().toLowerCase();
    if (!nextFilter) return commands;
    return commands.filter((command) => command.key.includes(nextFilter) || command.label.includes(nextFilter));
  }, [commandFilter]);

  const availableCommands = visibleCommands.length ? visibleCommands : commands;
  const activeCommand = availableCommands[activeCommandIndex] ?? availableCommands[0] ?? commands[0];
  const showPicker = pickerOpen && mode === "note";
  const editorValue = showPicker ? commandValue : body;
  const showNoteFolderPicker = mode === "note" && !showPicker && hasMeaningfulNoteInput(body);
  const noteFolderMatch = useMemo(() => resolveNoteFolderByName(state.noteFolders, noteFolderValue), [noteFolderValue, state.noteFolders]);
  const todoFolderTrimmed = todoFolderValue.trim();
  const todoFolderFilter = todoFolderTrimmed.toLowerCase();
  const todoFolderOptions = useMemo(() => {
    if (!todoFolderFilter) return state.todoFolders;
    return state.todoFolders.filter((folder) => folder.name.toLowerCase().includes(todoFolderFilter));
  }, [state.todoFolders, todoFolderFilter]);
  const todoFolderExactMatch = useMemo(
    () => state.todoFolders.find((folder) => folder.name.toLowerCase() === todoFolderFilter) ?? null,
    [state.todoFolders, todoFolderFilter],
  );
  const todoFolderMenuItems = useMemo(() => {
    const items: Array<{ kind: "existing" | "create"; key: string; label: string; value: string }> = todoFolderOptions.map((folder) => ({
      kind: "existing" as const,
      key: folder.id,
      label: folder.name,
      value: folder.name,
    }));

    if (todoFolderTrimmed && !todoFolderExactMatch) {
      items.push({
        kind: "create" as const,
        key: `create:${todoFolderTrimmed.toLowerCase()}`,
        label: `Create folder "${todoFolderTrimmed}"`,
        value: todoFolderTrimmed,
      });
    }

    return items;
  }, [todoFolderExactMatch, todoFolderOptions, todoFolderTrimmed]);
  const showTodoFolderMenu = mode === "todo" && todoFolderOpen;
  const bookmarkCategoryFilter = bookmarkCategoryValue.trim().toLowerCase();
  const bookmarkCategoryTrimmed = bookmarkCategoryValue.trim();
  const bookmarkCategoryOptions = useMemo(() => {
    if (!bookmarkCategoryFilter) return state.bookmarkCategories;
    return state.bookmarkCategories.filter((category) => category.name.toLowerCase().includes(bookmarkCategoryFilter));
  }, [bookmarkCategoryFilter, state.bookmarkCategories]);
  const bookmarkCategoryExactMatch = useMemo(
    () =>
      state.bookmarkCategories.find(
        (category) => category.name.toLowerCase() === bookmarkCategoryTrimmed.toLowerCase(),
      ) ?? null,
    [bookmarkCategoryTrimmed, state.bookmarkCategories],
  );
  const bookmarkCategoryMenuItems = useMemo(() => {
    const items: BookmarkCategoryMenuItem[] = bookmarkCategoryOptions.map((category) => ({
      kind: "existing" as const,
      key: category.id,
      label: category.name,
      value: category.name,
    }));

    if (bookmarkCategoryTrimmed && !bookmarkCategoryExactMatch) {
      items.push({
        kind: "create" as const,
        key: `create:${bookmarkCategoryTrimmed.toLowerCase()}`,
        label: `Create folder "${bookmarkCategoryTrimmed}"`,
        value: bookmarkCategoryTrimmed,
      });
    }

    return items;
  }, [bookmarkCategoryExactMatch, bookmarkCategoryOptions, bookmarkCategoryTrimmed]);
  const showBookmarkCategoryMenu = mode === "bookmark" && bookmarkCategoryOpen;

  useLayoutEffect(() => {
    if (!showBookmarkCategoryMenu || !bookmarkCategoryContainerRef.current) {
      setCategoryMenuPos(null);
      return;
    }
    const rect = bookmarkCategoryContainerRef.current.getBoundingClientRect();
    const navHeightRaw = getComputedStyle(document.documentElement).getPropertyValue("--omanote-bottom-nav-height");
    const navHeight = Number.parseFloat(navHeightRaw) || 80;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const maxHeight = Math.max(80, viewportHeight - rect.bottom - navHeight - 16);
    setCategoryMenuPos({ top: rect.bottom + 8, left: rect.left, width: rect.width, maxHeight });
  }, [showBookmarkCategoryMenu]);

  useEffect(() => {
    if (!showPicker) {
      setActiveCommandIndex(0);
    }
  }, [showPicker]);

  useEffect(() => {
    if (mode !== "note") return;
    const parsed = parseSlashCommand(body);
    if (!parsed) {
      if (pickerOpen) {
        setPickerOpen(false);
        setCommandValue("");
        setCommandFilter("");
      }
      return;
    }
    const nextVisible = parsed.filter
      ? commands.filter((command) => command.key.includes(parsed.filter) || command.label.includes(parsed.filter))
      : commands;
    if (!nextVisible.length) {
      setPickerOpen(false);
      setCommandValue("");
      setCommandFilter("");
      return;
    }
    setPickerOpen(true);
    setCommandValue(parsed.firstLine);
    setCommandFilter(parsed.filter);
    setActiveCommandIndex(0);
  }, [body, mode, pickerOpen]);

  useLayoutEffect(() => {
    if (!todoFocusPendingRef.current || mode !== "todo") return;
    todoFocusPendingRef.current = false;

    window.requestAnimationFrame(() => {
      focusTodoInput();
    });
  }, [mode, todoLines, activeTodoLineId]);

  useLayoutEffect(() => {
    if (!bookmarkFocusPendingRef.current || mode !== "bookmark") return;
    bookmarkFocusPendingRef.current = false;

    window.requestAnimationFrame(() => {
      bookmarkUrlInputRef.current?.focus();
    });
  }, [mode, bookmarkUrl]);

  useEffect(() => {
    if (!showBookmarkCategoryMenu) {
      setBookmarkCategoryActiveIndex(0);
      return;
    }

    setBookmarkCategoryActiveIndex((current) =>
      Math.min(current, Math.max(0, bookmarkCategoryMenuItems.length - 1)),
    );
  }, [bookmarkCategoryMenuItems.length, showBookmarkCategoryMenu]);

  useEffect(() => {
    if (!showTodoFolderMenu) {
      setTodoFolderActiveIndex(0);
      return;
    }

    setTodoFolderActiveIndex((current) =>
      Math.min(current, Math.max(0, todoFolderMenuItems.length - 1)),
    );
  }, [todoFolderMenuItems.length, showTodoFolderMenu]);

  useLayoutEffect(() => {
    if (!eventFocusPendingRef.current || mode !== "event") return;
    eventFocusPendingRef.current = false;

    window.requestAnimationFrame(() => {
      focusEventInput();
    });
  }, [mode, eventLines, activeEventLineId]);

  useLayoutEffect(() => {
    if (!showPicker || !shellRef.current || !pickerRef.current) return;

    const shellRect = shellRef.current.getBoundingClientRect();
    const menuHeight = pickerRef.current.getBoundingClientRect().height;
    const navHeightRaw = getComputedStyle(document.documentElement).getPropertyValue("--omanote-bottom-nav-height");
    const navHeight = Number.parseFloat(navHeightRaw) || 96;
    const availableBelow = window.innerHeight - shellRect.bottom - navHeight - 24;
    const availableAbove = shellRect.top - 24;

    if (availableBelow < menuHeight && availableAbove > availableBelow) {
      setPickerPlacement("above");
    } else {
      setPickerPlacement("below");
    }
  }, [commandFilter, showPicker, editorValue, visibleCommands.length]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const onViewportChange = () => {
      queueEnsureEditorVisible();
    };
    viewport.addEventListener("resize", onViewportChange);
    viewport.addEventListener("scroll", onViewportChange);
    return () => {
      viewport.removeEventListener("resize", onViewportChange);
      viewport.removeEventListener("scroll", onViewportChange);
    };
  }, [queueEnsureEditorVisible]);

  const focusNoteComposer = () => {
    window.requestAnimationFrame(() => {
      const editorEl = noteEditorHostRef.current?.querySelector<HTMLElement>(".ProseMirror");
      editorEl?.focus();
    });
  };

  const commit = ({ focusAfter = true }: { focusAfter?: boolean } = {}) => {
    const text = mode === "bookmark" ? bookmarkUrl.trim() : body.trim();
    if (!text) {
      allowTodoBlurRef.current = false;
      allowBookmarkBlurRef.current = false;
      allowEventBlurRef.current = false;
      return;
    }

    if (mode === "note") {
      const nextFolderValue = noteFolderValue.trim();
      const shouldTreatAsFolder = Boolean(nextFolderValue) && !isUncategorizedFolderName(nextFolderValue);
      if (shouldTreatAsFolder) {
        writeLastNoteFolder(nextFolderValue);
      }
      dispatch({
        type: "note/create",
        body: text,
        hashtags: parseHashtags(text),
        dateKey: state.ui.selectedDateKey,
        folderId: noteFolderMatch?.id,
        folderName: shouldTreatAsFolder ? nextFolderValue : undefined,
      });
    }

    if (mode === "todo") {
      dispatch({
        type: "todo/create",
        title: text,
        hashtags: parseHashtags(text),
        dateKey: state.ui.selectedDateKey,
        folderId: todoFolderExactMatch?.id,
        folderName: todoFolderTrimmed || "Others",
      });
    }

    if (mode === "bookmark") {
      const nextCategory = bookmarkCategoryValue.trim();
      dispatch({
        type: "bookmark/create",
        url: text,
        dateKey: state.ui.selectedDateKey,
        categoryName: nextCategory || undefined,
      });
      if (nextCategory) {
        writeLastBookmarkCategory(nextCategory);
      }
    }

    if (mode === "event") {
      const parsed = parseEventDraftInput(text, eventStartedAtRef.current);
      dispatch({
        type: "event/create",
        label: parsed.title,
        hashtags: parseHashtags(parsed.title),
        dateKey: state.ui.selectedDateKey,
        loggedAt: parsed.loggedAt,
      });
    }

    setBody("");
    setNoteFolderValue(readLastNoteFolder());
    setBookmarkUrl("");
    setMode("note");
    allowTodoBlurRef.current = false;
    allowBookmarkBlurRef.current = false;
    allowEventBlurRef.current = false;
    eventStartedAtRef.current = Date.now();
    suppressSwitcherRef.current = true;
    setMobileSwitcherVisible(false);
    if (focusAfter) {
      focusNoteComposer();
    } else {
      setNoteFocused(false);
    }
    window.requestAnimationFrame(() => {
      suppressSwitcherRef.current = false;
    });
  };

  const resetNoteDraft = () => {
    setPickerOpen(false);
    setCommandValue("");
    setCommandFilter("");
    setBody("");
    setMode("note");
    setNoteFocused(false);
    allowTodoBlurRef.current = true;
    allowBookmarkBlurRef.current = true;
    allowEventBlurRef.current = true;
  };

  const selectCommand = (command: { key: DraftMode; label: string }) => {
    setMode(command.key);
    setPickerOpen(false);
    setCommandValue("");
    setCommandFilter("");
    setBody("");
    setBookmarkUrl("");
    if (command.key === "event") {
      eventStartedAtRef.current = Date.now();
      const firstLine = createTodoDraftLine();
      setEventLines([firstLine]);
      setActiveEventLineId(firstLine.id);
      eventFocusPendingRef.current = true;
      return;
    }
    if (command.key === "todo") {
      const firstLine = createTodoDraftLine();
      setTodoLines([firstLine]);
      setActiveTodoLineId(firstLine.id);
      todoFocusPendingRef.current = true;
    }
    if (command.key === "bookmark") {
      const savedCategory = readLastBookmarkCategory();
      setBookmarkCategoryValue(savedCategory.trim());
      setBookmarkCategoryOpen(false);
      setBookmarkCategoryActiveIndex(0);
      bookmarkFocusPendingRef.current = true;
      window.requestAnimationFrame(() => {
        bookmarkUrlInputRef.current?.focus();
      });
      return;
    }
    if (command.key !== "todo") {
      window.requestAnimationFrame(() => {
        focusNoteComposer();
      });
    }
  };

  const focusTodoInput = () => {
    const activeLine = todoLineRefs.current[activeTodoLineId] ?? todoLineRefs.current[todoLines[0]?.id ?? ""];
    if (activeLine) {
      activeLine.focus();
    }
  };

  const focusEventInput = () => {
    const activeLine = eventLineRefs.current[activeEventLineId] ?? eventLineRefs.current[eventLines[0]?.id ?? ""];
    if (activeLine) {
      activeLine.focus();
    }
  };

  const focusEventLine = (lineId: string) => {
    window.requestAnimationFrame(() => {
      eventLineRefs.current[lineId]?.focus();
      window.requestAnimationFrame(() => {
        allowEventBlurRef.current = false;
      });
    });
  };

  const commitTodoDraft = () => {
    const parsedLines = todoLines
      .map((line) => parseTodoDraftInput(line.text))
      .filter((line) => line.title.trim().length > 0);
    if (!parsedLines.length) {
      allowTodoBlurRef.current = false;
      return;
    }

    const resolvedFolderId = todoFolderExactMatch?.id;
    const resolvedFolderName = todoFolderTrimmed || "Others";

    for (const line of parsedLines) {
      dispatch({
        type: "todo/create",
        title: line.title,
        dateKey: state.ui.selectedDateKey,
        dueDateKey: line.dueDateKey,
        dueTime: line.dueTime,
        folderId: resolvedFolderId,
        folderName: resolvedFolderName,
      });
    }

    const nextLine = createTodoDraftLine();
    setTodoLines([nextLine]);
    setActiveTodoLineId(nextLine.id);
    setBody("");
    allowTodoBlurRef.current = true;
    setMode("note");
    suppressSwitcherRef.current = true;
    setMobileSwitcherVisible(false);
    window.requestAnimationFrame(() => {
      focusNoteComposer();
      suppressSwitcherRef.current = false;
    });
  };

  const resetTodoDraft = () => {
    const nextLine = createTodoDraftLine();
    setTodoLines([nextLine]);
    setActiveTodoLineId(nextLine.id);
    setTodoFolderValue("Others");
    setTodoFolderOpen(false);
    setTodoFolderActiveIndex(0);
    allowTodoBlurRef.current = false;
  };

  const commitEventDraft = () => {
    const parsedLines = eventLines
      .map((line) => parseEventDraftInput(line.text, eventStartedAtRef.current))
      .filter((line) => line.title.trim().length > 0);
    if (!parsedLines.length) {
      allowEventBlurRef.current = false;
      return;
    }

    for (const line of parsedLines) {
      dispatch({
        type: "event/create",
        label: line.title,
        dateKey: state.ui.selectedDateKey,
        loggedAt: line.loggedAt,
      });
    }

    const nextLine = createTodoDraftLine();
    setEventLines([nextLine]);
    setActiveEventLineId(nextLine.id);
    eventStartedAtRef.current = Date.now();
    allowEventBlurRef.current = true;
    setMode("note");
    suppressSwitcherRef.current = true;
    setMobileSwitcherVisible(false);
    window.requestAnimationFrame(() => {
      focusNoteComposer();
      suppressSwitcherRef.current = false;
    });
  };

  const resetEventDraft = () => {
    const nextLine = createTodoDraftLine();
    setEventLines([nextLine]);
    setActiveEventLineId(nextLine.id);
    allowEventBlurRef.current = false;
  };

  const resetBookmarkDraft = () => {
    setBookmarkUrl("");
    setBookmarkCategoryValue(readLastBookmarkCategory());
    setBookmarkCategoryOpen(false);
    setBookmarkCategoryActiveIndex(0);
    allowBookmarkBlurRef.current = false;
  };

  const cancelBookmarkDraft = () => {
    setPickerOpen(false);
    setCommandValue("");
    setCommandFilter("");
    resetBookmarkDraft();
    setMode("note");
    allowBookmarkBlurRef.current = true;
    window.requestAnimationFrame(() => {
      focusNoteComposer();
    });
  };

  const applyBookmarkFromUrl = (url: string) => {
    setMode("bookmark");
    setBookmarkUrl(url);
    setBody("");
    setCommandValue("");
    setCommandFilter("");
    setPickerOpen(false);
    const savedCategory = readLastBookmarkCategory();
    const existingCategory =
      state.bookmarkCategories.find((category) => category.name.toLowerCase() === savedCategory.trim().toLowerCase()) ??
      state.bookmarkCategories[0];
    setBookmarkCategoryValue(existingCategory?.name ?? savedCategory);
    setBookmarkCategoryOpen(false);
  };

  useOutsideClick(shellRef, mode === "note" || mode === "todo" || mode === "bookmark" || mode === "event", () => {
    if (mobileKeyboard.isMobileViewport) return;
    if (mode === "note") {
      if (body.trim()) commit({ focusAfter: false });
      return;
    }
    if (mode === "todo") {
      commitTodoDraft();
      return;
    }
    if (mode === "event") {
      commitEventDraft();
      return;
    }
    commit();
  });

  const canSaveNote = mode === "note" && body.trim().length > 0;
  const canSaveTodo = mode === "todo" && todoLines.some((line) => parseTodoDraftInput(line.text).title.trim().length > 0);
  const canSaveBookmark = mode === "bookmark" && bookmarkUrl.trim().length > 0;
  const canSaveEvent = mode === "event" && eventLines.some((line) => parseEventDraftInput(line.text, eventStartedAtRef.current).title.trim().length > 0);
  const canSaveCurrent = canSaveNote || canSaveTodo || canSaveBookmark || canSaveEvent;
  const showMobileTypeSwitcher = mobileSwitcherVisible;
  const activeTodoLine = mode === "todo" ? (todoLines.find((line) => line.id === activeTodoLineId) ?? todoLines[0] ?? null) : null;
  const todoPicker = useHashtagPicker({
    value: activeTodoLine?.text ?? "",
    textareaRef: activeTodoInputRef,
    onChange: (next) => {
      if (!activeTodoLine) return;
      setTodoLines((current) =>
        current.map((currentLine) =>
          currentLine.id === activeTodoLine.id ? { ...currentLine, text: next } : currentLine,
        ),
      );
    },
  });
  const activeEventLine = mode === "event" ? (eventLines.find((line) => line.id === activeEventLineId) ?? eventLines[0] ?? null) : null;
  const eventPicker = useHashtagPicker({
    value: activeEventLine?.text ?? "",
    textareaRef: activeEventInputRef,
    onChange: (next) => {
      if (!activeEventLine) return;
      setEventLines((current) =>
        current.map((currentLine) =>
          currentLine.id === activeEventLine.id ? { ...currentLine, text: next } : currentLine,
        ),
      );
    },
  });

  const handleMobileSave = () => {
    if (mode === "todo") {
      commitTodoDraft();
      return;
    }
    if (mode === "event") {
      commitEventDraft();
      return;
    }
    commit();
  };

  const currentDraftText = () => {
    if (mode === "todo") return draftLinesToText(todoLines);
    if (mode === "event") return draftLinesToText(eventLines);
    if (mode === "bookmark") return bookmarkUrl;
    return body;
  };

  const focusDraftMode = (nextMode: DraftMode) => {
    window.requestAnimationFrame(() => {
      if (nextMode === "todo") {
        focusTodoInput();
        return;
      }
      if (nextMode === "event") {
        focusEventInput();
        return;
      }
      if (nextMode === "bookmark") {
        bookmarkUrlInputRef.current?.focus();
        return;
      }
      focusNoteComposer();
    });
  };

  const switchDraftMode = (nextMode: DraftMode) => {
    if (nextMode === mode) {
      focusDraftMode(nextMode);
      return;
    }

    const text = currentDraftText();
    setMobileSwitcherVisible(true);
    setPickerOpen(false);
    setCommandValue("");
    setCommandFilter("");
    allowTodoBlurRef.current = true;
    allowBookmarkBlurRef.current = true;
    allowEventBlurRef.current = true;

    if (nextMode === "note") {
      setBody(text);
      setMode("note");
      setNoteFocused(true);
      focusDraftMode("note");
      return;
    }

    if (nextMode === "todo") {
      const nextLines = textToDraftLines(text);
      setTodoLines(nextLines);
      setActiveTodoLineId(nextLines[0]?.id ?? "");
      setMode("todo");
      todoFocusPendingRef.current = true;
      return;
    }

    if (nextMode === "event") {
      const nextLines = textToDraftLines(text);
      setEventLines(nextLines);
      setActiveEventLineId(nextLines[0]?.id ?? "");
      eventStartedAtRef.current = Date.now();
      setMode("event");
      eventFocusPendingRef.current = true;
      return;
    }

    setBookmarkUrl(text);
    setBookmarkCategoryValue(readLastBookmarkCategory().trim());
    setBookmarkCategoryOpen(false);
    setBookmarkCategoryActiveIndex(0);
    setMode("bookmark");
    bookmarkFocusPendingRef.current = true;
  };

  return (
    <>
    <div ref={shellRef} className="mt-6 px-0 md:pl-8 md:pr-2">
      <div className="relative">
        {showMobileTypeSwitcher ? <MobileArtifactTypeSwitcher activeMode={mode} onModeChange={switchDraftMode} /> : null}
        {mode === "todo" || mode === "bookmark" || mode === "event" ? (
          mode === "bookmark" ? (
            <div className="flex items-center gap-3">
              <div aria-hidden="true" className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center">
                <span className="flex h-5 w-5 items-center justify-center rounded border border-app-line-strong bg-app-surface text-success-ink">
                  <Bookmark className="h-3.5 w-3.5" />
                </span>
              </div>
              <input
                ref={bookmarkUrlInputRef}
                value={bookmarkUrl}
                onChange={(event) => {
                  setBookmarkUrl(event.target.value);
                  allowBookmarkBlurRef.current = false;
                }}
                onFocus={() => {
                  setMobileSwitcherVisible(true);
                  queueEnsureEditorVisible();
                }}
                onBlur={(event) => {
                  if (allowBookmarkBlurRef.current) {
                    allowBookmarkBlurRef.current = false;
                    return;
                  }

                  if (event.relatedTarget === bookmarkCategoryInputRef.current) {
                    return;
                  }

                  hideMobileSwitcherIfFocusLeavesDraft();
                  window.requestAnimationFrame(() => {
                    if (document.activeElement !== bookmarkCategoryInputRef.current) {
                      bookmarkUrlInputRef.current?.focus();
                    }
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelBookmarkDraft();
                    return;
                  }

                  if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
                    event.preventDefault();
                    allowBookmarkBlurRef.current = true;
                    commit();
                    return;
                  }

                  if (isSaveShortcutEvent(event, settings.saveShortcut)) {
                    event.preventDefault();
                    allowBookmarkBlurRef.current = true;
                    commit();
                    return;
                  }
                }}
                placeholder="Paste or type a URL"
                className="min-w-0 flex-1 border-0 bg-transparent px-0 py-0.5 text-[15px] leading-6 text-app-ink caret-app-ink outline-none placeholder:text-app-line-strong selection:bg-app-surface-muted selection:text-app-ink"
              />
              <div ref={bookmarkCategoryContainerRef} className="relative w-[220px] flex-none">
              <input
                ref={bookmarkCategoryInputRef}
                value={bookmarkCategoryValue}
                onChange={(event) => {
                  setBookmarkCategoryValue(event.target.value);
                  setBookmarkCategoryOpen(true);
                  setBookmarkCategoryActiveIndex(0);
                }}
                onFocus={() => {
                  setMobileSwitcherVisible(true);
                  queueEnsureEditorVisible();
                }}
                onBlur={() => {
                  hideMobileSwitcherIfFocusLeavesDraft();
                  window.requestAnimationFrame(() => {
                    setBookmarkCategoryOpen(false);
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelBookmarkDraft();
                    return;
                  }
                  if (isSaveShortcutEvent(event, settings.saveShortcut)) {
                    event.preventDefault();
                    allowBookmarkBlurRef.current = true;
                    commit();
                    return;
                  }
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    if (!bookmarkCategoryMenuItems.length) return;
                    event.preventDefault();
                    setBookmarkCategoryOpen(true);
                    setBookmarkCategoryActiveIndex((current) => {
                      if (event.key === "ArrowDown") {
                        return (current + 1) % bookmarkCategoryMenuItems.length;
                      }
                      return (current - 1 + bookmarkCategoryMenuItems.length) % bookmarkCategoryMenuItems.length;
                    });
                    return;
                  }
                  if ((event.key === "Enter" || event.key === "Tab") && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                    if (!bookmarkCategoryMenuItems.length) return;
                    event.preventDefault();
                    const nextItem = bookmarkCategoryMenuItems[bookmarkCategoryActiveIndex] ?? bookmarkCategoryMenuItems[0];
                    if (!nextItem) return;
                    setBookmarkCategoryValue(nextItem.value);
                    setBookmarkCategoryOpen(false);
                    allowBookmarkBlurRef.current = true;
                    window.requestAnimationFrame(() => {
                      bookmarkUrlInputRef.current?.focus();
                    });
                    return;
                  }
                }}
                placeholder={bookmarkCategoryTrimmed ? "Folder" : "Uncategorized"}
                className="w-full border-b border-app-line bg-transparent px-0 pr-7 py-0.5 text-[15px] text-app-ink-faint outline-none placeholder:text-app-line-strong focus:border-app-line-strong"
              />
              {bookmarkCategoryValue.trim() ? (
                <button
                  type="button"
                  aria-label="Clear folder"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setBookmarkCategoryValue("");
                    setBookmarkCategoryOpen(true);
                    setBookmarkCategoryActiveIndex(0);
                    bookmarkCategoryInputRef.current?.focus();
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
              </div>
            </div>
          ) : (
            <div className="w-full space-y-1.5">
              {(mode === "todo" ? todoLines : eventLines).map((line, index) => (
                <div key={line.id} className="flex w-full items-center gap-3">
                  {mode === "todo" ? (
                    <TodoCheckmark
                      type="button"
                      aria-hidden="true"
                      tabIndex={-1}
                      checked={false}
                      className="mt-0.5"
                    />
                  ) : (
                    <div aria-hidden="true" className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center">
                      <span className="flex h-5 w-5 items-center justify-center rounded border border-app-line-strong bg-app-surface text-app-line-strong">
                        <Clock3 className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 w-full flex flex-1 flex-col md:flex-row md:gap-3">
                    <div className="min-w-0 flex-1 md:flex-[7]">
                    <div className="relative">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0 top-0 w-full select-none whitespace-pre-wrap break-words px-0 py-0.5 text-[15px] leading-6 text-transparent"
                      >
                        {hashtagHighlightSegments(line.text).map(({ text, isHashtag, name }, i) => {
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
                        {line.text === "" && "\u200b"}
                      </div>
                      <input
                        ref={(node) => {
                          if (mode === "todo") {
                            todoLineRefs.current[line.id] = node;
                            if (line.id === activeTodoLineId) activeTodoInputRef.current = node;
                          } else {
                            eventLineRefs.current[line.id] = node;
                            if (line.id === activeEventLineId) activeEventInputRef.current = node;
                          }
                        }}
                        value={line.text}
                        onChange={(event) => {
                          const nextText = event.target.value;
                          if (mode === "todo") {
                            setTodoLines((current) => current.map((currentLine) => (currentLine.id === line.id ? { ...currentLine, text: nextText } : currentLine)));
                          } else {
                            setEventLines((current) => current.map((currentLine) => (currentLine.id === line.id ? { ...currentLine, text: nextText } : currentLine)));
                          }
                        }}
                        onPaste={(event) => {
                          if (mode === "todo") {
                            handlePasteAsLink(event, line.text, (nextValue) => {
                              setTodoLines((current) => current.map((currentLine) => (currentLine.id === line.id ? { ...currentLine, text: nextValue } : currentLine)));
                            });
                          } else {
                            handlePasteAsLink(event, line.text, (nextValue) => {
                              setEventLines((current) => current.map((currentLine) => (currentLine.id === line.id ? { ...currentLine, text: nextValue } : currentLine)));
                            });
                          }
                        }}
                        onFocus={() => {
                          setMobileSwitcherVisible(true);
                          if (mode === "todo") {
                            setActiveTodoLineId(line.id);
                          } else {
                            setActiveEventLineId(line.id);
                          }
                          queueEnsureEditorVisible();
                        }}
                        onBlur={(event) => {
                          if (mobileKeyboard.isMobileViewport) return;
                          if (mode === "todo") {
                            const relatedTarget = event.relatedTarget;
                            if (relatedTarget instanceof HTMLElement && Object.values(todoLineRefs.current).some((ref) => ref === relatedTarget)) {
                              return;
                            }
                            if (relatedTarget === todoFolderInputRef.current) {
                              return;
                            }

                            hideMobileSwitcherIfFocusLeavesDraft();
                            if (allowTodoBlurRef.current) {
                              allowTodoBlurRef.current = false;
                              return;
                            }

                            commitTodoDraft();
                            return;
                          }

                          const relatedTarget = event.relatedTarget;
                          if (relatedTarget instanceof HTMLElement && Object.values(eventLineRefs.current).some((ref) => ref === relatedTarget)) {
                            return;
                          }

                          hideMobileSwitcherIfFocusLeavesDraft();
                          if (allowEventBlurRef.current) {
                            allowEventBlurRef.current = false;
                            return;
                          }

                          commitEventDraft();
                        }}
                        onKeyDown={(event) => {
                          if (mode === "todo" && todoPicker.handleKeyDown(event)) {
                            return;
                          }
                          if (mode === "event" && eventPicker.handleKeyDown(event)) {
                            return;
                          }

                          if (event.key === "Escape") {
                            event.preventDefault();
                            setPickerOpen(false);
                            setCommandValue("");
                            setCommandFilter("");
                            if (mode === "todo") {
                              resetTodoDraft();
                            } else {
                              resetEventDraft();
                            }
                            setMode("note");
                            allowTodoBlurRef.current = true;
                            allowEventBlurRef.current = true;
                            window.requestAnimationFrame(() => {
                              focusNoteComposer();
                            });
                            return;
                          }

                          if (isSaveShortcutEvent(event, settings.saveShortcut)) {
                            event.preventDefault();
                            if (mode === "todo") {
                              commitTodoDraft();
                            } else {
                              commitEventDraft();
                            }
                            return;
                          }

                          if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
                            event.preventDefault();
                            if (mode === "todo") {
                              commitTodoDraft();
                            } else {
                              commitEventDraft();
                            }
                            return;
                          }

                          if (event.key === "Enter" && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
                            event.preventDefault();
                            const nextLine = createTodoDraftLine();
                            if (mode === "todo") {
                              setTodoLines((current) => {
                                const next = [...current];
                                next.splice(index + 1, 0, nextLine);
                                return next;
                              });
                              setActiveTodoLineId(nextLine.id);
                            } else {
                              allowEventBlurRef.current = true;
                              setEventLines((current) => {
                                const next = [...current];
                                next.splice(index + 1, 0, nextLine);
                                return next;
                              });
                              setActiveEventLineId(nextLine.id);
                            }
                            window.requestAnimationFrame(() => {
                              if (mode === "todo") {
                                todoLineRefs.current[nextLine.id]?.focus();
                              } else {
                                focusEventLine(nextLine.id);
                              }
                            });
                            return;
                          }

                          if (isNewlineShortcutEvent(event, settings.newlineShortcut)) {
                            event.preventDefault();
                            return;
                          }

                          if (event.key === "Backspace" && line.text.length === 0 && index > 0) {
                            event.preventDefault();
                            if (mode === "todo") {
                              const previousLine = todoLines[index - 1];
                              setTodoLines((current) => current.filter((currentLine) => currentLine.id !== line.id));
                              setActiveTodoLineId(previousLine.id);
                              window.requestAnimationFrame(() => {
                                todoLineRefs.current[previousLine.id]?.focus();
                              });
                            } else {
                              const previousLine = eventLines[index - 1];
                              setEventLines((current) => current.filter((currentLine) => currentLine.id !== line.id));
                              setActiveEventLineId(previousLine.id);
                              window.requestAnimationFrame(() => {
                                eventLineRefs.current[previousLine.id]?.focus();
                              });
                            }
                          }
                        }}
                        placeholder={index === 0 ? (mode === "todo" ? "Write your checklist" : "Write your event") : ""}
                        className="relative min-w-0 w-full flex-1 border-0 bg-transparent px-0 py-0.5 text-[15px] leading-6 text-app-ink caret-app-ink outline-none placeholder:text-app-line-strong selection:bg-app-surface-muted selection:text-app-ink"
                      />
                    </div>
                    </div>
                    {mode === "todo" && index === 0 ? (
                      <div ref={todoFolderContainerRef} className="relative mt-2 md:mt-0 w-full md:w-[30%]">
                        <input
                          ref={todoFolderInputRef}
                          value={todoFolderValue}
                          onChange={(event) => {
                            setTodoFolderValue(event.target.value);
                            setTodoFolderOpen(true);
                            setTodoFolderActiveIndex(0);
                          }}
                          onFocus={() => {
                            setTodoFolderOpen(true);
                            setMobileSwitcherVisible(true);
                            queueEnsureEditorVisible();
                          }}
                          onBlur={() => {
                            hideMobileSwitcherIfFocusLeavesDraft();
                            window.requestAnimationFrame(() => {
                              setTodoFolderOpen(false);
                            });
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setTodoFolderOpen(false);
                              focusTodoInput();
                              return;
                            }
                            if (isSaveShortcutEvent(event, settings.saveShortcut)) {
                              event.preventDefault();
                              allowTodoBlurRef.current = true;
                              commitTodoDraft();
                              return;
                            }
                            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                              if (!todoFolderMenuItems.length) return;
                              event.preventDefault();
                              setTodoFolderOpen(true);
                              setTodoFolderActiveIndex((current) => {
                                if (event.key === "ArrowDown") {
                                  return (current + 1) % todoFolderMenuItems.length;
                                }
                                return (current - 1 + todoFolderMenuItems.length) % todoFolderMenuItems.length;
                              });
                              return;
                            }
                            if ((event.key === "Enter" || event.key === "Tab") && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                              if (!todoFolderMenuItems.length) return;
                              event.preventDefault();
                              const nextItem = todoFolderMenuItems[todoFolderActiveIndex] ?? todoFolderMenuItems[0];
                              if (!nextItem) return;
                              setTodoFolderValue(nextItem.value);
                              setTodoFolderOpen(false);
                              allowTodoBlurRef.current = true;
                              window.requestAnimationFrame(() => {
                                focusTodoInput();
                              });
                              return;
                            }
                          }}
                          placeholder="Folder"
                          className="w-full border-b border-app-line bg-transparent px-0 pr-7 py-0.5 text-[15px] text-app-ink-faint outline-none placeholder:text-app-line-strong focus:border-app-line-strong"
                        />
                        {todoFolderValue.trim() ? (
                          <button
                            type="button"
                            aria-label="Clear folder"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setTodoFolderValue("");
                              setTodoFolderOpen(true);
                              setTodoFolderActiveIndex(0);
                              todoFolderInputRef.current?.focus();
                            }}
                            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {showTodoFolderMenu && todoFolderMenuItems.length ? (
                          <div
                            className="absolute left-0 right-0 top-full z-20 mt-2 overflow-y-auto rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
                            onMouseDown={(event) => event.preventDefault()}
                          >
                            {todoFolderMenuItems.map((item, index) => (
                              <button
                                key={item.key}
                                type="button"
                                className={[
                                  "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                                  index === todoFolderActiveIndex ? "bg-app-surface-muted text-app-ink" : "text-app-ink-muted hover:bg-app-surface-hover",
                                ].join(" ")}
                                onMouseEnter={() => setTodoFolderActiveIndex(index)}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  setTodoFolderValue(item.value);
                                  setTodoFolderOpen(false);
                                  setTodoFolderActiveIndex(0);
                                  allowTodoBlurRef.current = true;
                                  window.requestAnimationFrame(() => {
                                    focusTodoInput();
                                  });
                                }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {mode === "todo" ? (
                <HashtagPickerDropdown
                  isOpen={todoPicker.isOpen}
                  suggestions={todoPicker.suggestions}
                  activeIndex={todoPicker.activeIndex}
                  onSelect={todoPicker.selectSuggestion}
                  onHover={todoPicker.setActiveIndex}
                  anchorRef={activeTodoInputRef}
                />
              ) : null}
              {mode === "event" ? (
                <HashtagPickerDropdown
                  isOpen={eventPicker.isOpen}
                  suggestions={eventPicker.suggestions}
                  activeIndex={eventPicker.activeIndex}
                  onSelect={eventPicker.selectSuggestion}
                  onHover={eventPicker.setActiveIndex}
                  anchorRef={activeEventInputRef}
                />
              ) : null}
            </div>
          )
        ) : (
          <div
            ref={noteEditorHostRef}
            onKeyDownCapture={(event) => {
              if (!showPicker) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveCommandIndex((current) => (current + 1) % availableCommands.length);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveCommandIndex((current) => (current - 1 + availableCommands.length) % availableCommands.length);
                return;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                const nextCommand = availableCommands[activeCommandIndex] ?? activeCommand;
                selectCommand(nextCommand);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setPickerOpen(false);
                setCommandValue("");
                setCommandFilter("");
                return;
              }
            }}
            onFocusCapture={() => {
              setNoteFocused(true);
              if (!suppressSwitcherRef.current) setMobileSwitcherVisible(true);
              queueEnsureEditorVisible();
            }}
            onBlurCapture={() => {
              setNoteFocused(false);
              hideMobileSwitcherIfFocusLeavesDraft();
            }}
          >
            <NoteCanvasEditor
              body={body}
              folderName={noteFolderValue}
              folders={state.noteFolders}
              placeholder="Type your note"
              onBodyChange={(next) => {
                setBody(next);
              }}
              onFolderNameChange={setNoteFolderValue}
              onPastePlainText={applyBookmarkFromUrl}
              suppressToolbar={showPicker}
              suppressToolbarOnMobile
              onCommit={(payload) => {
                const trimmed = payload.body.trim();
                if (!trimmed) return;
                dispatch({
                  type: "note/create",
                  body: trimmed,
                  hashtags: parseHashtags(trimmed),
                  dateKey: state.ui.selectedDateKey,
                  folderId: payload.folderId,
                  folderName: payload.folderName,
                });
                setBody("");
                setNoteFolderValue(readLastNoteFolder());
                setMode("note");
                suppressSwitcherRef.current = true;
                setMobileSwitcherVisible(false);
                window.requestAnimationFrame(() => {
                  focusNoteComposer();
                  suppressSwitcherRef.current = false;
                });
              }}
              onCancel={resetNoteDraft}
            />
            {showPicker ? (
              <div
                ref={pickerRef}
                className={[
                  "absolute left-0 z-30 w-40 overflow-hidden rounded-md border border-app-line bg-app-surface shadow-soft",
                  pickerPlacement === "above" ? "bottom-full mb-1.5" : "top-full mt-1.5",
                ].join(" ")}
              >
                {availableCommands.map((command, index) => (
                  <button
                    key={command.key}
                    type="button"
                    className={[
                      "flex w-full items-center px-3 py-2 text-left text-sm transition",
                      index === activeCommandIndex ? "bg-app-surface-muted text-app-ink" : "text-app-ink-faint hover:bg-app-surface-hover",
                    ].join(" ")}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setActiveCommandIndex(index);
                      setCommandValue(`/${command.key}`);
                    }}
                    onClick={() => selectCommand(command)}
                  >
                    {command.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {mode !== "note" || body.trim() ? (
        <div className="mt-3 flex items-center justify-end gap-3">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              aria-label="Cancel"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (mode === "bookmark") {
                  cancelBookmarkDraft();
                } else if (mode === "todo") {
                  resetTodoDraft();
                  allowTodoBlurRef.current = true;
                  allowEventBlurRef.current = true;
                  setMode("note");
                  window.requestAnimationFrame(() => { focusNoteComposer(); });
                } else if (mode === "event") {
                  resetEventDraft();
                  allowTodoBlurRef.current = true;
                  allowEventBlurRef.current = true;
                  setMode("note");
                  window.requestAnimationFrame(() => { focusNoteComposer(); });
                } else {
                  setBody("");
                  allowTodoBlurRef.current = true;
                  allowEventBlurRef.current = true;
                  window.requestAnimationFrame(() => { focusNoteComposer(); });
                }
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-line bg-app-surface-muted text-app-ink-muted transition hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98] md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
            {canSaveCurrent ? <MobileSaveButton onClick={handleMobileSave} /> : null}
          </div>
        </div>
      ) : null}
    </div>
    {showBookmarkCategoryMenu && categoryMenuPos && bookmarkCategoryMenuItems.length
      ? createPortal(
          <div
            data-omanote-ignore-outside-click="true"
            className="fixed z-[200] overflow-y-auto rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
            style={{ top: categoryMenuPos.top, left: categoryMenuPos.left, width: categoryMenuPos.width, maxHeight: categoryMenuPos.maxHeight }}
            onMouseDown={(event) => event.preventDefault()}
          >
            {bookmarkCategoryMenuItems.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={[
                  "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                  index === bookmarkCategoryActiveIndex ? "bg-app-surface-muted text-app-ink" : "text-app-ink-muted hover:bg-app-surface-hover",
                ].join(" ")}
                onMouseEnter={() => setBookmarkCategoryActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setBookmarkCategoryValue(item.value);
                  setBookmarkCategoryOpen(false);
                  setBookmarkCategoryActiveIndex(0);
                  allowBookmarkBlurRef.current = true;
                  window.requestAnimationFrame(() => {
                    bookmarkUrlInputRef.current?.focus();
                  });
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null}
    </>
  );
}
