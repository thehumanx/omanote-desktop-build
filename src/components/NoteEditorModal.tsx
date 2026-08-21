import { useRef, useState } from "react";
import type { NoteFolder } from "@omanote/shared";
import { BaseModal } from "./BaseModal";
import { DrawerHeaderRow } from "./DrawerHeaderRow";
import { NoteInlineEditor, type NoteInlineEditorHandle } from "./NoteInlineEditor";

// Floating card overlay on mobile -- inset from all edges, fully rounded --
// and a centered dialog on desktop, matching TodoEditorModal/BookmarkEditorModal.
const BACKDROP_CLASS = "items-end px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:items-center md:px-app-page md:pb-0";
const SURFACE_CLASS =
  "w-full max-w-2xl rounded-2xl border border-app-line bg-app-surface-raised p-5 shadow-app-drawer max-h-[85vh] overflow-y-auto md:max-h-none md:overflow-visible md:bg-app-surface md:shadow-soft";

export function NoteEditorModal({
  folders,
  defaultFolderName,
  selectedFolderId,
  onClose,
  onSave,
}: {
  folders: NoteFolder[];
  defaultFolderName?: string;
  selectedFolderId?: string | null;
  onClose: () => void;
  onSave: (payload: { body: string; tags: string[]; hashtags: string[]; folderName?: string; folderId?: string }) => void;
}) {
  const editorRef = useRef<NoteInlineEditorHandle>(null);
  const [canSave, setCanSave] = useState(false);

  return (
    <BaseModal onClose={onClose} backdropProps={{ className: BACKDROP_CLASS }}>
      <div className={SURFACE_CLASS} onMouseDown={(event) => event.stopPropagation()}>
        <DrawerHeaderRow
          className="-mx-5 -mt-5 mb-2 px-4 pt-3 pb-2"
          onCancel={onClose}
          onSave={() => editorRef.current?.commit()}
          canSave={canSave}
        />
        <NoteInlineEditor
          ref={editorRef}
          folders={folders}
          defaultFolderName={defaultFolderName}
          selectedFolderId={selectedFolderId}
          autoFocus
          layout="canvas"
          showTags={false}
          hideFolderPicker
          hideMobileActions
          persistRecentFolderOnSave
          onCancel={onClose}
          onSave={onSave}
          onCanSaveChange={setCanSave}
        />
      </div>
    </BaseModal>
  );
}
