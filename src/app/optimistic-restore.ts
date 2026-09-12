import type { DateKey, EventEntry, NoteItem, PageItem, TodoItem } from "@omanote/shared";
import { listCanvasOutbox } from "./canvas-outbox";

/**
 * Rebuilds the optimistic rows for writes that are still queued.
 *
 * Optimistic rows live in reducer state, so a reload while offline used to
 * hide a pending artifact until reconnect — the write survived in the outbox,
 * but the user saw their todo vanish and reappear an hour later.
 *
 * **These are derived from the outbox rather than persisted separately**, for
 * two reasons. First, an optimistic row is the decrypted, display-ready shape:
 * persisting it would put plaintext note bodies and todo titles at rest in
 * IndexedDB, where the rest of the cache deliberately holds only ciphertext.
 * The outbox already stores the *encrypted* mutation arguments, so decrypting
 * them at startup keeps that invariant. Second, it leaves one source of truth:
 * a row shows as pending exactly while its write is queued, with no way for a
 * separate table to disagree with the queue.
 *
 * Only the create kinds produce rows here, because only a create has no row
 * anywhere else to stand in for it. **A queued update or delete is still not
 * reflected after a reload**: its target is already in the Dexie cache, so the
 * row reappears with its pre-edit content until the queue drains. Fixing that
 * means overlaying pending edits onto cached rows, which is a different and
 * larger job than this one.
 */

type Decryptors = {
  decrypt: (value: string) => Promise<string>;
  decryptOptional: (value: string | undefined) => Promise<string | undefined>;
};

type RestoredOptimisticRows = {
  todos: TodoItem[];
  notes: NoteItem[];
  pages: PageItem[];
  events: EventEntry[];
};

const EMPTY: RestoredOptimisticRows = { todos: [], notes: [], pages: [], events: [] };

/**
 * A queued write carries no server timestamp, so the row is dated from when it
 * was enqueued. That's also the honest answer: it's when the user made it.
 */
export async function restoreOptimisticRows({ decrypt, decryptOptional }: Decryptors): Promise<RestoredOptimisticRows> {
  const queued = await listCanvasOutbox();
  if (!queued.length) return EMPTY;

  const restored: RestoredOptimisticRows = { todos: [], notes: [], pages: [], events: [] };

  for (const item of queued) {
    const payload = item.payload as Record<string, unknown>;
    // Without a clientKey there's nothing to reconcile against when the server
    // echoes the row back, so the row would duplicate itself forever. Every
    // create path sets one; skipping is the safe response to a legacy entry.
    const clientKey = typeof payload.clientKey === "string" ? payload.clientKey : undefined;
    if (!clientKey) continue;

    try {
      switch (item.kind) {
        case "todo/create":
          restored.todos.push({
            id: clientKey,
            clientKey,
            pendingSync: true,
            title: await decrypt(String(payload.title ?? "")),
            notes: undefined,
            dueDateKey: payload.dueDateKey as DateKey | undefined,
            dueTime: payload.dueTime as string | undefined,
            priority: "normal",
            status: "open",
            createdAt: item.createdAt,
            updatedAt: item.createdAt,
            createdDateKey: payload.dateKey as DateKey,
            sourceNoteId: undefined,
            reminderFiredAt: undefined,
            folderId: payload.folderId as string | undefined,
            // The queued name is encrypted; a todo filed into an existing
            // folder carries only the id and resolves its label from state.
            folderName: payload.folderId ? undefined : await decryptOptional(payload.folderName as string | undefined),
            recurrence: payload.recurrence as TodoItem["recurrence"],
            reminderEveryMinutes: payload.reminderEveryMinutes as number | undefined,
            reminderUntil: payload.reminderUntil as number | undefined,
          });
          break;

        case "note/create":
          restored.notes.push({
            id: clientKey,
            clientKey,
            pendingSync: true,
            title: await decryptOptional(payload.title as string | undefined),
            body: await decrypt(String(payload.body ?? "")),
            tags: (payload.tags as string[] | undefined) ?? [],
            folderId: undefined,
            folderName: await decryptOptional(payload.folderName as string | undefined),
            createdAt: item.createdAt,
            updatedAt: item.createdAt,
            createdDateKey: payload.dateKey as DateKey,
          });
          break;

        case "page/create":
          restored.pages.push({
            id: clientKey,
            clientKey,
            pendingSync: true,
            title: await decryptOptional(payload.title as string | undefined),
            icon: payload.icon as string | undefined,
            preview: await decrypt(String(payload.preview ?? "")),
            docJson: await decrypt(String(payload.docJson ?? "")),
            hashtags: (payload.hashtags as string[] | undefined) ?? [],
            createdAt: item.createdAt,
            updatedAt: item.createdAt,
            createdDateKey: payload.dateKey as DateKey,
          });
          break;

        case "event/create":
          restored.events.push({
            id: clientKey,
            clientKey,
            pendingSync: true,
            label: await decrypt(String(payload.label ?? "")),
            notes: await decryptOptional(payload.notes as string | undefined),
            sourceType: "manual",
            loggedAt: (payload.loggedAt as number | undefined) ?? item.createdAt,
            createdAt: item.createdAt,
            createdDateKey: payload.dateKey as DateKey,
          });
          break;

        default:
          break;
      }
    } catch {
      // A row that won't decrypt is a row from a different content key — a
      // queue entry that outlived a passphrase change. Dropping it from the
      // *display* is right; the outbox still holds the write, and the server
      // remains the judge of whether it lands.
      continue;
    }
  }

  return restored;
}
