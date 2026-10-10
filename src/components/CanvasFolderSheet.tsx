import { Suspense, useCallback, useState } from "react";
import { lazyWithReload } from "../lib/lazy-with-reload";
import type { CanvasFolderTarget } from "./CanvasDayArtifacts";

// Lazy, like their routes: the canvas shouldn't carry three screens' code
// until a folder tab is actually clicked.
const TodosScreen = lazyWithReload(() => import("../screens/TodosScreen").then((module) => ({ default: module.TodosScreen })));
const NotesScreen = lazyWithReload(() => import("../screens/NotesScreen").then((module) => ({ default: module.NotesScreen })));
const BookmarksScreen = lazyWithReload(() =>
  import("../screens/BookmarksScreen").then((module) => ({ default: module.BookmarksScreen })),
);

/**
 * A canvas folder tab opens that folder's sheet right over the canvas — the
 * same sheet its Todos / Notes / Bookmarks gallery opens, whatever view mode
 * that page is set to — without leaving the canvas. The owning screen is
 * mounted in overlay mode (just its sheet) while the sheet is up, and
 * unmounted once it has slid away.
 */
export function useCanvasFolderSheet() {
  const [target, setTarget] = useState<(CanvasFolderTarget & { id: number }) | null>(null);

  const openFolder = useCallback((next: CanvasFolderTarget) => {
    setTarget({ ...next, id: Date.now() });
  }, []);

  let sheet = null;
  if (target) {
    const overlay = {
      folderKey: target.folderKey,
      // Only clear the sheet that finished closing, not one opened since.
      onClosed: () => setTarget((current) => (current?.id === target.id ? null : current)),
    };
    const Screen = target.kind === "todo" ? TodosScreen : target.kind === "note" ? NotesScreen : BookmarksScreen;
    sheet = (
      <Suspense fallback={null}>
        <Screen key={target.id} overlay={overlay} />
      </Suspense>
    );
  }

  return { openFolder, sheet };
}
