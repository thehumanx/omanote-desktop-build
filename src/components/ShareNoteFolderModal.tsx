import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Check, Copy, Eye, Link, X } from "lucide-react";
import { BaseModal } from "./BaseModal";
import { cn } from "./ui";
import { useApp } from "../app/AppProvider";

const DOMAIN = "omanote.com";

function buildShareUrl(shareCode: string) {
  return `https://${DOMAIN}/n/${shareCode}`;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [isTogglingShare, setIsTogglingShare] = useState(false);
  const [snapshotPushed, setSnapshotPushed] = useState(false);
  const copyResetRef = useRef<number | null>(null);

  const share = useQuery(api.sharedNoteFolders.getFolderShare, {
    folderId: folderId as Id<"noteFolders">,
  });
  const setShareActive = useMutation(api.sharedNoteFolders.setShareActive);
  const updateShareSnapshot = useMutation(api.sharedNoteFolders.updateShareSnapshot);

  const isActive = share?.isActive ?? false;
  const shareUrl = share ? buildShareUrl(share.shareCode) : null;

  const folderNotes = state.notes
    .filter((n) => n.folderId === folderId && !n.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      tags: n.tags,
    }));

  const pushSnapshot = useCallback(async () => {
    await updateShareSnapshot({
      folderId: folderId as Id<"noteFolders">,
      folderName,
      folderIcon,
      notes: folderNotes,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateShareSnapshot, folderId, folderName, folderIcon, state.notes]);

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
      await setShareActive({
        folderId: folderId as Id<"noteFolders">,
        isActive: nextActive,
      });
      if (nextActive) {
        setSnapshotPushed(true);
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
        className="w-full max-w-md rounded-2xl border border-app-line bg-app-surface p-5 shadow-soft"
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
            <Toggle checked={isActive} onChange={handleToggle} />
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
                  {shareUrl ?? `https://${DOMAIN}/n/········`}
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
              )}

              {!isActive && (
                <p className="text-xs text-app-ink-faint">
                  Turn on public link to share this folder with anyone.
                </p>
              )}
            </>
          )}

          {share === undefined && (
            <div className="h-10 animate-pulse rounded-xl bg-app-surface-muted" />
          )}
        </div>
    </BaseModal>
  );
}
