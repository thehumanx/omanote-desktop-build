import { useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useApp } from "../app/AppProvider";
import { ShareFolderModalShell } from "./ShareFolderModalShell";

/** Share modal for a bookmark category or a todo folder. */
export function ShareFolderModal({
  categoryId,
  categoryName,
  categoryIcon,
  type = "bookmark",
  onClose,
}: {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  type?: "bookmark" | "todo";
  onClose: () => void;
}) {
  const { state } = useApp();
  const isTodo = type === "todo";

  const share = useQuery(
    isTodo ? api.sharedTodoFolders.getFolderShare : api.sharedFolders.getCategoryShare,
    isTodo
      ? { todoFolderId: categoryId as Id<"todoFolders"> }
      : { categoryId: categoryId as Id<"bookmarkCategories"> },
  );
  const setShareActive = useMutation(
    isTodo ? api.sharedTodoFolders.setShareActive : api.sharedFolders.setShareActive,
  );
  const updateShareSnapshot = useMutation(
    isTodo ? api.sharedTodoFolders.updateShareSnapshot : api.sharedFolders.updateShareSnapshot,
  );
  const setLinkViewMode = useMutation(api.sharedFolders.setLinkViewMode);

  const pushSnapshot = useCallback(async () => {
    if (isTodo) {
      await updateShareSnapshot({
        todoFolderId: categoryId as Id<"todoFolders">,
        folderName: categoryName,
        folderIcon: categoryIcon,
        todos: state.todos
          .filter((t) => t.folderId === categoryId && !t.deletedAt)
          .map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            dueDateKey: t.dueDateKey,
            dueTime: t.dueTime,
            createdAt: t.createdAt,
            completedAt: t.completedAt,
          })),
      });
    } else {
      await updateShareSnapshot({
        categoryId: categoryId as Id<"bookmarkCategories">,
        categoryName,
        categoryIcon,
        bookmarks: state.bookmarks
          .filter((b) => b.categoryId === categoryId && !b.deletedAt)
          .map((b) => ({
            id: b.id,
            url: b.url,
            title: b.title,
            siteName: b.siteName,
            description: b.description,
            thumbnailUrl: b.thumbnailUrl,
            faviconUrl: b.faviconUrl,
          })),
      });
    }
  }, [updateShareSnapshot, categoryId, categoryName, categoryIcon, state.bookmarks, state.todos, isTodo]);

  return (
    <ShareFolderModalShell
      folderName={categoryName}
      share={share}
      setActive={(isActive) =>
        isTodo
          ? setShareActive({ todoFolderId: categoryId as Id<"todoFolders">, isActive, folderName: categoryName })
          : setShareActive({ categoryId: categoryId as Id<"bookmarkCategories">, isActive, categoryName })
      }
      pushSnapshot={pushSnapshot}
      setLinkViewMode={
        isTodo
          ? undefined
          : (linkViewMode) => void setLinkViewMode({ categoryId: categoryId as Id<"bookmarkCategories">, linkViewMode })
      }
      metaKind="folder"
      encryptionNoun={isTodo ? "todos" : "links"}
      onClose={onClose}
    />
  );
}
