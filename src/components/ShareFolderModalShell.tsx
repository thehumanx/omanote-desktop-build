import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Check, Copy, Eye, LayoutGrid, LayoutList, Link, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { BaseModal } from "./BaseModal";
import { ShareEncryptionNotice } from "./ShareEncryptionNotice";
import { ShareLinkMetaEditor } from "./ShareLinkMetaEditor";
import { cn } from "./ui";
import { useShareLinkMeta } from "../lib/use-share-link-meta";
import { buildShareUrl, SHARE_DOMAIN } from "../lib/share-url";

export function ShareToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        checked ? "bg-action-primary" : "bg-app-line",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-app-surface shadow-sm transition duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

/** The fields every folder-share row has, whichever table it lives in. */
type FolderShare = {
  _id: string;
  isActive: boolean;
  shareCode: string;
  customSlug?: string;
  description?: string;
  thumbnailStorageId?: Id<"_storage">;
  thumbnailUrl?: string | null;
  viewCount: number;
  linkViewMode?: "card" | "list";
};

/**
 * Share-a-folder modal body, shared by bookmark categories, todo folders
 * (ShareFolderModal) and note folders (ShareNoteFolderModal). Those wrappers
 * own only what differs per folder kind — which Convex functions to call and
 * what goes into the snapshot; everything the user sees lives here.
 */
export function ShareFolderModalShell({
  folderName,
  share,
  setActive,
  pushSnapshot,
  setLinkViewMode,
  metaKind,
  encryptionNoun,
  onClose,
}: {
  folderName: string;
  /** `undefined` while loading, `null` if the folder has never been shared. */
  share: FolderShare | null | undefined;
  setActive: (isActive: boolean) => Promise<unknown>;
  pushSnapshot: () => Promise<unknown>;
  /** Omitted for folder kinds with no link previews to lay out (todos). */
  setLinkViewMode?: (mode: "card" | "list") => void;
  /** Note shares live in their own table, so their metadata has its own mutations. */
  metaKind: "folder" | "note";
  encryptionNoun: "notes" | "todos" | "links";
  onClose: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [isTogglingShare, setIsTogglingShare] = useState(false);
  const [snapshotPushed, setSnapshotPushed] = useState(false);
  const copyResetRef = useRef<number | null>(null);

  const generateThumbnailUploadUrl = useMutation(api.sharedFolderMeta.generateThumbnailUploadUrl);
  const setThumbnail = useMutation(
    metaKind === "note" ? api.sharedFolderMeta.setNoteShareThumbnail : api.sharedFolderMeta.setShareThumbnail,
  );
  const setSlug = useMutation(metaKind === "note" ? api.sharedFolderMeta.setNoteShareSlug : api.sharedFolderMeta.setShareSlug);
  const setDescription = useMutation(
    metaKind === "note" ? api.sharedFolderMeta.setNoteShareDescription : api.sharedFolderMeta.setShareDescription,
  );

  // The share id's table differs per kind; each meta mutation validates it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shareId = share?._id as any;
  const meta = useShareLinkMeta({
    share,
    folderName,
    generateUploadUrl: generateThumbnailUploadUrl,
    setThumbnail: (storageId) => (share ? setThumbnail({ shareId, storageId }) : Promise.resolve()),
    setSlug: (slug) => (share ? setSlug({ shareId, slug }) : Promise.resolve()),
    setDescription: (description) => (share ? setDescription({ shareId, description }) : Promise.resolve()),
  });

  const isActive = share?.isActive ?? false;
  const shareUrl = share ? buildShareUrl(share.customSlug || share.shareCode) : null;

  // When the modal opens on an already-active share, push a fresh snapshot once
  useEffect(() => {
    if (snapshotPushed || share === undefined || !share?.isActive) return;
    setSnapshotPushed(true);
    void pushSnapshot();
  }, [share, snapshotPushed, pushSnapshot]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    };
  }, []);

  const handleToggle = async (nextActive: boolean) => {
    if (isTogglingShare) return;
    setIsTogglingShare(true);
    try {
      await setActive(nextActive);
      if (nextActive) {
        setSnapshotPushed(true); // prevent useEffect from double-pushing
        void pushSnapshot();
      }
    } finally {
      setIsTogglingShare(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = shareUrl;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopyState("copied");
    copyResetRef.current = window.setTimeout(() => setCopyState("idle"), 2000);
  };

  return (
    <BaseModal onClose={onClose} onBackdropMouseDown={onClose} zIndex="z-app-dialog">
      <div
        className="w-full max-w-md rounded-app-dialog border border-app-line bg-app-surface p-5 shadow-soft"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-app-ink">Share folder</h2>
            <p className="mt-0.5 text-sm text-app-ink-faint truncate max-w-[300px]">{folderName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-app-line bg-app-surface-muted px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link className="h-4 w-4 flex-shrink-0 text-app-ink-faint" />
            <span className="text-sm text-app-ink-muted font-medium">Public link</span>
          </div>
          <ShareToggle checked={isActive} onChange={handleToggle} />
        </div>

        {share !== undefined && (
          <>
            <div
              className={cn(
                "mb-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors",
                isActive ? "border-app-line bg-app-surface" : "border-app-line bg-app-surface-muted",
              )}
            >
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[13px] font-mono",
                  isActive ? "text-app-ink-muted" : "text-app-ink-faint",
                )}
              >
                {shareUrl ?? `https://${SHARE_DOMAIN}/s/········`}
              </span>
              <button
                type="button"
                disabled={!isActive || !shareUrl}
                onClick={handleCopy}
                aria-label="Copy link"
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition",
                  isActive
                    ? "text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink"
                    : "cursor-not-allowed text-app-line-strong",
                )}
              >
                {copyState === "copied" ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {isActive && share && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-xs text-app-ink-faint">
                  <Eye className="h-3.5 w-3.5" />
                  <span>
                    {share.viewCount === 0
                      ? "Not opened yet"
                      : share.viewCount === 1
                        ? "Opened 1 time"
                        : `Opened ${share.viewCount} times`}
                  </span>
                </div>
                {setLinkViewMode && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-app-line bg-app-surface-muted px-4 py-3">
                    <span className="text-sm text-app-ink-muted font-medium">Link view</span>
                    <div className="flex overflow-hidden rounded-md border border-app-line">
                      <button
                        type="button"
                        onClick={() => setLinkViewMode("card")}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition",
                          (share.linkViewMode ?? "card") === "card"
                            ? "bg-app-surface text-app-ink"
                            : "bg-app-surface-muted text-app-ink-faint hover:text-app-ink-muted",
                        )}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setLinkViewMode("list")}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition",
                          share.linkViewMode === "list"
                            ? "bg-app-surface text-app-ink"
                            : "bg-app-surface-muted text-app-ink-faint hover:text-app-ink-muted",
                        )}
                      >
                        <LayoutList className="h-3.5 w-3.5" />
                        List
                      </button>
                    </div>
                  </div>
                )}

                <ShareLinkMetaEditor domain={SHARE_DOMAIN} {...meta} />
              </div>
            )}

            {!isActive && (
              <p className="text-xs text-app-ink-faint">
                Turn on public link to share this folder with anyone.
              </p>
            )}

            <ShareEncryptionNotice noun={encryptionNoun} className="mt-3" />
          </>
        )}

        {share === undefined && <div className="h-10 animate-pulse rounded-xl bg-app-surface-muted" />}
      </div>
    </BaseModal>
  );
}
