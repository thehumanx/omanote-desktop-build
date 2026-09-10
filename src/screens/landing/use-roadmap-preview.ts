import { useMemo } from "react";
import { useQuery } from "convex/react";
import type { TodoItem } from "@omanote/shared";
import { api } from "../../../convex/_generated/api";
import {
  PREVIEW_ROADMAP_FALLBACK,
  PREVIEW_TODAY_KEY,
  ROADMAP_SLOT_TIMES,
} from "./canvas-preview-data";

/** Public share slug for the roadmap todo folder — omanote.com/s/roadmap. */
const ROADMAP_SHARE_CODE = "roadmap";

/** Keeps the day feed readable; the full list lives on the share page. */
const MAX_ROADMAP_TODOS = ROADMAP_SLOT_TIMES.length;

/**
 * The real, currently-open roadmap items, for the landing page's canvas
 * preview.
 *
 * `getPublicShare` needs no auth — public shares are stored unencrypted
 * precisely so they can be read by anyone — so this works for a signed-out
 * visitor. It reads a snapshot, so there's no cost to the owner's live data,
 * and `recordShareView` is deliberately not called: the marketing page
 * shouldn't inflate the share's view count.
 *
 * Falls back to fixtures while the query is in flight and if it fails or the
 * share is turned off, so the preview never renders a gap or a skeleton in the
 * hero. Due dates are dropped on purpose — see PREVIEW_OVERDUE_TODOS.
 */
export function useRoadmapPreviewTodos(): TodoItem[] {
  const share = useQuery(api.sharedTodoFolders.getPublicShare, {
    shareCode: ROADMAP_SHARE_CODE,
  });

  return useMemo(() => {
    // `undefined` is in-flight, `null` is "no such share / turned off".
    if (!share) return PREVIEW_ROADMAP_FALLBACK;

    const open = share.todos
      .filter((todo) => todo.status === "open")
      .slice(0, MAX_ROADMAP_TODOS);

    if (open.length === 0) return PREVIEW_ROADMAP_FALLBACK;

    return open.map((todo, index) => ({
      id: `roadmap-${todo.id}`,
      title: todo.title,
      priority: "normal" as const,
      status: "open" as const,
      // No dueDateKey: a real roadmap item may well be past its date, and the
      // preview must not render omanote's own slipped deadlines in red.
      createdAt: ROADMAP_SLOT_TIMES[index]!,
      updatedAt: ROADMAP_SLOT_TIMES[index]!,
      createdDateKey: PREVIEW_TODAY_KEY,
      folderId: "folder-roadmap",
      folderName: share.folderName || "Roadmap",
    }));
  }, [share]);
}
