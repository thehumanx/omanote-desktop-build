import { addDays, toDateKey } from "@omanote/shared";
import type { AppState } from "./types";

const now = new Date();
const todayKey = toDateKey(now);
const tomorrow = addDays(now, 1);
const yesterday = addDays(now, -1);

export function createInitialState(): AppState {
  return {
    ui: {
      selectedDateKey: todayKey,
      dateWindowOffset: 0,
      tab: "canvas",
      todoFilter: "today",
      searchQuery: "",
      searchOpen: false,
      notesDrawerOpen: false,
    },
    todos: [
      {
        id: "todo-1",
        title: "Plan weekly groceries",
        priority: "normal",
        status: "open",
        createdAt: Date.now() - 86_400_000,
        updatedAt: Date.now() - 86_400_000,
        createdDateKey: toDateKey(yesterday),
      },
      {
        id: "todo-2",
        title: "Clean my room",
        priority: "high",
        status: "open",
        createdAt: Date.now() - 3_600_000,
        updatedAt: Date.now() - 3_600_000,
        createdDateKey: todayKey,
        dueDateKey: toDateKey(tomorrow),
        dueTime: "00:00",
      },
    ],
    todoFolders: [],
    checklistItems: [
      {
        id: "checklist-1",
        todoId: "todo-1",
        text: "Plan weekly groceries",
        checked: false,
        position: 0,
        createdAt: Date.now() - 86_400_000,
        updatedAt: Date.now() - 86_400_000,
      },
      {
        id: "checklist-2",
        todoId: "todo-2",
        text: "Clean my room",
        checked: false,
        position: 0,
        createdAt: Date.now() - 3_600_000,
        updatedAt: Date.now() - 3_600_000,
      },
    ],
    notes: [
      {
        id: "note-1",
        title: "Morning reset",
        body: "Write one line that matters.\nThen get moving.",
        tags: ["daily", "focus"],
        createdAt: Date.now() - 7200_000,
        updatedAt: Date.now() - 7200_000,
        createdDateKey: todayKey,
      },
    ],
    deletedNotes: [],
    noteFolders: [],
    bookmarks: [],
    deletedBookmarks: [],
    bookmarkCategories: [
      {
        id: "cat-1",
        name: "Reading",
        createdAt: Date.now() - 86400_000,
      },
    ],
    events: [
      {
        id: "event-1",
        label: "Woke up",
        loggedAt: Date.now() - 5 * 60 * 60 * 1000,
        createdAt: Date.now() - 5 * 60 * 60 * 1000,
        createdDateKey: todayKey,
      },
    ],
    habits: [],
    activity: [
      {
        id: "activity-1",
        module: "todo",
        action: "created",
        itemId: "todo-1",
        itemTitle: "Plan weekly groceries",
        restorable: false,
        timestamp: Date.now() - 86_400_000,
      },
    ],
    toasts: [],
    recurringDeletePrompt: null,
  };
}
