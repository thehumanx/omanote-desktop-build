import { useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useApp } from "../app/AppProvider";
import { ShareFolderModalShell } from "./ShareFolderModalShell";

/** Share modal for a note folder. */
export function ShareNoteFolderModal({
  folderId,
  folderName,
  folderIcon,
  onClose,
}: {
  folderId: string;
  folderName: string;
  folderIcon?: string;
  onClose: () => void;
}) {
  const { state } = useApp();
  const noteFolderId = folderId as Id<"noteFolders">;

  const share = useQuery(api.sharedNoteFolders.getFolderShare, { folderId: noteFolderId });
  const setShareActive = useMutation(api.sharedNoteFolders.setShareActive);
  const updateShareSnapshot = useMutation(api.sharedNoteFolders.updateShareSnapshot);
  const setLinkViewMode = useMutation(api.sharedNoteFolders.setLinkViewMode);

  const pushSnapshot = useCallback(
    () =>
      updateShareSnapshot({
        folderId: noteFolderId,
        folderName,
        folderIcon,
        notes: state.notes
          .filter((n) => n.folderId === folderId && !n.deletedAt)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((n) => ({ id: n.id, title: n.title, body: n.body, tags: n.tags })),
      }),
    [updateShareSnapshot, noteFolderId, folderId, folderName, folderIcon, state.notes],
  );

  return (
    <ShareFolderModalShell
      folderName={folderName}
      share={share}
      setActive={(isActive) => setShareActive({ folderId: noteFolderId, isActive, folderName })}
      pushSnapshot={pushSnapshot}
      setLinkViewMode={(linkViewMode) => void setLinkViewMode({ folderId: noteFolderId, linkViewMode })}
      metaKind="note"
      encryptionNoun="notes"
      onClose={onClose}
    />
  );
}
