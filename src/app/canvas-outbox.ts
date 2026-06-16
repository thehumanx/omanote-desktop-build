import type { DateKey } from "@omanote/shared";
import { prefixedRandomId } from "@omanote/shared";

const STORAGE_KEY = "omanote.canvas-outbox";

type NoteCreatePayload = {
  clientKey?: string;
  body: string;
  dateKey: string;
  title?: string;
  tags?: string[];
  folderName?: string;
  draftKey?: string;
};

type NoteUpdatePayload = {
  noteId: string;
  body: string;
  title?: string;
  tags: string[];
  folderName?: string;
  draftKey?: string;
};

type NoteDeletePayload = {
  noteId: string;
  draftKey?: string;
};

type NoteRestorePayload = {
  noteId: string;
  draftKey?: string;
};

type EventCreatePayload = {
  clientKey?: string;
  label: string;
  dateKey: string;
  loggedAt?: number;
  notes?: string;
  hashtags?: string[];
  draftKey?: string;
};

type EventUpdatePayload = {
  eventId: string;
  label: string;
  loggedAt: number;
  notes?: string;
  hashtags?: string[];
  draftKey?: string;
};

type EventDeletePayload = {
  eventId: string;
  draftKey?: string;
};

type EventRestorePayload = {
  eventId: string;
  draftKey?: string;
};

type TodoCreatePayload = {
  title: string;
  dateKey: string;
  clientKey?: string;
  dueDateKey?: string;
  dueTime?: string;
  hashtags?: string[];
};

type TodoUpdatePayload = {
  todoId: string;
  title: string;
  dueDateKey?: string;
  dueTime?: string;
  hashtags?: string[];
};

type TodoDeletePayload = {
  todoId: string;
};

type TodoRestorePayload = {
  todoId: string;
};

type TodoTogglePayload = {
  todoId: string;
};

type TodoSnoozePayload = {
  todoId: string;
  minutes: number;
};

type TodoMarkFiredPayload = {
  todoId: string;
  timestamp: number;
};

type TodoChecklistEnsurePayload = {
  todoId: string;
  text: string;
  clientKey?: string;
};

type TodoChecklistCreatePayload = {
  todoId: string;
  text: string;
  afterItemId?: string;
  clientKey?: string;
};

type TodoChecklistUpdatePayload = {
  itemId: string;
  text: string;
  checked: boolean;
  clientKey?: string;
};

type TodoChecklistDeletePayload = {
  itemId: string;
  clientKey?: string;
};

type TodoChecklistTogglePayload = {
  itemId: string;
  clientKey?: string;
};

type BookmarkCreatePayload = {
  clientKey?: string;
  categoryId?: string;
  categoryName?: string;
  dateKey: DateKey;
  url: string;
  title?: string;
  siteName?: string;
  description?: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
  draftKey?: string;
};

type BookmarkUpdatePayload = {
  bookmarkId: string;
  categoryId?: string;
  categoryName?: string;
  url: string;
  title?: string;
  siteName?: string;
  description?: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
  draftKey?: string;
};

type CanvasPayloadMap = {
  "note/create": NoteCreatePayload;
  "note/update": NoteUpdatePayload;
  "note/delete": NoteDeletePayload;
  "note/restore": NoteRestorePayload;
  "event/create": EventCreatePayload;
  "event/update": EventUpdatePayload;
  "event/delete": EventDeletePayload;
  "event/restore": EventRestorePayload;
  "todo/create": TodoCreatePayload;
  "todo/update": TodoUpdatePayload;
  "todo/delete": TodoDeletePayload;
  "todo/restore": TodoRestorePayload;
  "todo/toggle": TodoTogglePayload;
  "todo/snooze": TodoSnoozePayload;
  "todo/mark-fired": TodoMarkFiredPayload;
  "todo/checklist/ensure": TodoChecklistEnsurePayload;
  "todo/checklist/create": TodoChecklistCreatePayload;
  "todo/checklist/update": TodoChecklistUpdatePayload;
  "todo/checklist/delete": TodoChecklistDeletePayload;
  "todo/checklist/toggle": TodoChecklistTogglePayload;
  "bookmark/create": BookmarkCreatePayload;
  "bookmark/update": BookmarkUpdatePayload;
};

export type CanvasKind = keyof CanvasPayloadMap;

type OutboxItem<K extends CanvasKind = CanvasKind> = {
  id: string;
  kind: K;
  createdAt: number;
  attempts: number;
  payload: CanvasPayloadMap[K];
};

type HandlerMap = Partial<{
  [K in CanvasKind]: (payload: CanvasPayloadMap[K]) => Promise<void>;
}>;

function newId() {
  return prefixedRandomId("outbox");
}

function readOutbox(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboxItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: OutboxItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore quota and privacy mode failures.
  }
}

export function enqueueCanvasMutation<K extends CanvasKind>(kind: K, payload: CanvasPayloadMap[K]) {
  const items = readOutbox();
  items.push({
    id: newId(),
    kind,
    createdAt: Date.now(),
    attempts: 0,
    payload,
  });
  writeOutbox(items);
}

export async function runWithCanvasOutboxFallback<K extends CanvasKind>(
  kind: K,
  payload: CanvasPayloadMap[K],
  operation: () => Promise<void> | void,
) {
  try {
    await operation();
  } catch {
    enqueueCanvasMutation(kind, payload);
  }
}

const MAX_ATTEMPTS = 5;
const MAX_ITEM_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function flushCanvasOutbox(handlers: HandlerMap) {
  const items = readOutbox();
  if (!items.length) return;

  const removedIds = new Set<string>();
  const attemptBumps = new Map<string, number>();
  const now = Date.now();

  for (const item of items) {
    if (now - item.createdAt > MAX_ITEM_AGE_MS) {
      removedIds.add(item.id);
      continue;
    }
    const handler = handlers[item.kind];
    if (!handler) continue;
    try {
      await handler(item.payload as never);
      removedIds.add(item.id);
    } catch {
      const next = (item.attempts ?? 0) + 1;
      if (next >= MAX_ATTEMPTS) {
        removedIds.add(item.id);
      } else {
        attemptBumps.set(item.id, next);
      }
    }
  }

  if (removedIds.size === 0 && attemptBumps.size === 0) return;

  const nextItems = items
    .filter((item) => !removedIds.has(item.id))
    .map((item) => {
      const bumped = attemptBumps.get(item.id);
      return bumped !== undefined ? { ...item, attempts: bumped } : item;
    });

  writeOutbox(nextItems);
}

export function clearCanvasDraftForKey(draftKey?: string) {
  if (!draftKey || typeof window === "undefined") return;
  const draftsKey = "omanote.canvas-drafts";
  try {
    const raw = window.localStorage.getItem(draftsKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return;
    delete parsed[`${draftKey}:body`];
    delete parsed[`${draftKey}:title`];
    delete parsed[`${draftKey}:tags`];
    delete parsed[`${draftKey}:categoryId`];
    delete parsed[`${draftKey}:url`];
    delete parsed[`${draftKey}:siteName`];
    delete parsed[`${draftKey}:description`];
    delete parsed[`${draftKey}:thumbnailUrl`];
    delete parsed[`${draftKey}:faviconUrl`];
    delete parsed[`${draftKey}:text`];
    delete parsed[`${draftKey}:checked`];
    delete parsed[`${draftKey}:notes`];
    window.localStorage.setItem(draftsKey, JSON.stringify(parsed));
  } catch {
    // Ignore storage failures.
  }
}
